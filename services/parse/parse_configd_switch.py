import re
import json
from collections import defaultdict

def get_link_id(interface_name):
    """
    Fallback: Remove any leading letters from an interface name.
    For example, "Gi1/0/5" becomes "1/0/5".
    """
    return re.sub(r'^[A-Za-z]+', '', interface_name)

def extract_bpdu_port_id(stp_block):
    """
    Extract the BPDU port number from a spanning-tree block.
    For example, from a line like:
         "             Port        6 (GigabitEthernet1/0/6)"
    it returns the integer 6. Returns None if not found.
    """
    m = re.search(r'Port\s+(\d+)', stp_block)
    if m:
        return int(m.group(1))
    return None

def build_lldp_mapping(fetched_data):
    """
    Build a dictionary mapping (hostname, local_intf) to a common link ID.
    Iterates over each device in fetched_data and their 'lldp_neighbors' list.
    Each neighbor record is assumed to contain:
      - local_hostname
      - local_intf
      - remote_device
      - remote_intf
    The common link ID is created by sorting the two endpoint tuples.
    """
    mapping = {}
    for device in fetched_data:
        for nbr in device.get("lldp_neighbors", []):
            if not all(key in nbr for key in ("local_hostname", "local_intf", "remote_device", "remote_intf")):
                continue
            ep1 = (nbr["local_hostname"].strip(), nbr["local_intf"].strip())
            ep2 = (nbr["remote_device"].strip(), nbr["remote_intf"].strip())
            sorted_eps = sorted([ep1, ep2])
            link_id = f"{sorted_eps[0][0]}_{sorted_eps[0][1]}_{sorted_eps[1][0]}_{sorted_eps[1][1]}"
            mapping[ep1] = link_id
            mapping[ep2] = link_id
    return mapping

def parse_configd(big_output):
    parsed_data = []
    
    # Ensure output ends with a newline.
    if not big_output.endswith("\n"):
        big_output += "\n"
    
    # --- Extract each host’s JSON block individually.
    # Each block is of the form:
    #   ok: [HOSTNAME] => { "msg": [ ... ] }
    host_pattern = re.compile(
        r'''(?sx)
        ok:\s*\[([^\]]+)\]\s*=>\s*\{      # Capture hostname inside [ ]
            \s*"msg"\s*:\s*(\[.*?\])       # Capture the "msg": [ ... ] block (non-greedy)
        \s*\}                            # End of JSON object
        ''',
        re.DOTALL
    )
    
    hosts = []
    for match in host_pattern.finditer(big_output):
        hostname = match.group(1).strip()
        msg_array_text = match.group(2).strip()  # This is the JSON array containing at least three sections.
        host_json_text = '{ "msg": ' + msg_array_text + ' }'
        try:
            data_obj = json.loads(host_json_text)
        except Exception:
            continue
        msg = data_obj.get("msg", [])
        if len(msg) < 3:
            continue
        # If there is a fourth array, treat it as the LLDP neighbor block; otherwise, use an empty list.
        lldp_arr = msg[3] if len(msg) >= 4 else []
        hosts.append((hostname, msg[0], msg[1], msg[2], lldp_arr))
    
    # --- Regular expression definitions ---
    # (1) For the interface table (first array)
    interface_pattern = re.compile(
        r"^\s*([^\s]+)\s+([^\s]+)\s+YES\s+[^\s]+\s+(.+?)\s{2,}",
        re.MULTILINE
    )
    # (2) For VLAN brief lines (we capture VLAN numbers)
    vlan_brief_pattern = re.compile(
        r"(?<![a-zA-Z\/\.])\b(\d+)\b",
        re.MULTILINE
    )
    # (3) For STP detail (bridge/root information) from the STP section
    vlan_info_pattern = re.compile(r'''
        VLAN0*(?P<vlan>\d+).*?              # Match "VLAN" with optional leading zeros.
        Root\s+ID\s+Priority\s+\d+.*?
        Address\s+(?P<root_addr>[0-9A-Fa-f\.]+).*?
        Bridge\s+ID\s+Priority\s+\d+\s+\(priority\s+(?P<bridge_pri_paren>\d+).*?\).*?
        Address\s+(?P<bridge_addr>[0-9A-Fa-f\.]+)
        ''',
        re.DOTALL | re.VERBOSE | re.IGNORECASE
    )
    # (4) For splitting the STP section into blocks (each block begins with a line starting with "VLAN")
    vlan_stp_block_pattern = re.compile(r'(?m)^VLAN0*(\d+)(.*?)(?=^VLAN0*\d+|\Z)', re.DOTALL)
    # (5) For STP interface lines, we support many interface types.
    iface_prefixes = (
        r"Gigabit\s*Ethernet|Gi|Gig|"
        r"Fast\s*Ethernet|Fa|"
        r"TenGigabit\s*Ethernet|TenGig|Te|"
        r"TwentyFiveGigabit\s*Ethernet|TwentyFiveGig|TwentyFiveGigE|Twe|"
        r"FortyGigabit\s*Ethernet|Fo|"
        r"HundredGigabit\s*Ethernet|Hu|"
        r"TwoHundredGigabit\s*Ethernet|TwoHu|"
        r"FourHundredGigabit\s*Ethernet|FourHu"
    )
    stp_interface_pattern = re.compile(
        r'^(?P<intf>(?:(?:' + iface_prefixes + r')\S*))\b\s+'
        r'(?P<role>\S+)\s+\S+\s+(?P<cost>\d+(?:\.\d+)?)(?:\s+.*)?$',
        re.IGNORECASE | re.MULTILINE
    )
    # (6) For LLDP neighbor lines.
    lldp_pattern = re.compile(
        r'^\s*(?P<remote_device>\S+)\s+(?P<local_intf>\S+)\s+\S+\s+\S+\s+(?P<port_id>\S+)',
        re.IGNORECASE | re.MULTILINE
    )
    
    # --- Process each host ---
    for host_tuple in hosts:
        hostname, int_arr, vlan_brief_arr, stp_arr, lldp_arr = host_tuple
        
        # (a) Process interfaces from the first array.
        interfaces = []
        for line in int_arr:
            parts = line.split()
            if len(parts) < 4:
                continue
            interface = parts[0]
            ip_address = parts[1]
            status = parts[3]
            if "administratively" in line:
                status = "administratively down"
            interfaces.append({
                "interface": interface,
                "detail": {"ip_address": ip_address, "status": status}
            })
        
        # (b) Process VLAN brief from the second array.
        vlans_dict = {}
        vlan_brief_text = "\n".join(vlan_brief_arr)
        for m in vlan_brief_pattern.finditer(vlan_brief_text):
            try:
                vid = int(m.group(1))
            except Exception:
                continue
            if vid not in vlans_dict:
                vlans_dict[vid] = {"vlan_id": vid}
        print(f"DEBUG: Raw VLAN dict for host {hostname}:", json.dumps(vlans_dict, indent=2))
        # (c) Process STP detail (bridge/root info) from the third array.
        stp_text = "\n".join(stp_arr)
        stp_details = {}
        for match in vlan_info_pattern.finditer(stp_text):
            try:
                vid = int(match.group("vlan"))
            except Exception:
                continue
            stp_details[vid] = {
                "root_mac": match.group("root_addr"),
                "bridge_priority_in_brackets": match.group("bridge_pri_paren"),
                "bridge_mac": match.group("bridge_addr"),
                "isRoot": match.group("root_addr").lower() == match.group("bridge_addr").lower(),
                "stp_interfaces": []
            }
        
        # Merge STP details into VLAN brief dictionary (only for VLANs present in the brief)
        for vid, detail in stp_details.items():
            if vid in vlans_dict:
                vlans_dict[vid]["stp_detail"] = detail
        print(f"DEBUG: VLAN dict after merging STP for host {hostname}:", json.dumps(vlans_dict, indent=2))
        
        # (d) Process STP interface blocks from the entire STP text.
        for block in vlan_stp_block_pattern.finditer(stp_text):
            try:
                block_vid = int(block.group(1))
            except Exception:
                continue
            block_content = block.group(2)
            stp_ifaces = []
            # Extract the BPDU port number from the entire block content.
            bpdu_port = extract_bpdu_port_id(block_content)
            for ln in block_content.splitlines():
                ln = ln.strip()
                if not ln or ln.startswith("Interface") or ln.startswith("-"):
                    continue
                m_intf = stp_interface_pattern.match(ln)
                if m_intf:
                    iface = m_intf.group("intf")
                    role = m_intf.group("role")
                    cost_str = m_intf.group("cost")
                    cost = float(cost_str) if '.' in cost_str else int(cost_str)
                    entry = {
                        "interface": iface,
                        "interface_role": role,
                        "cost": cost
                    }
                    # Add the BPDU port (if found) to each interface entry.
                    if bpdu_port is not None:
                        entry["bpdu_port"] = bpdu_port
                    stp_ifaces.append(entry)
            if stp_ifaces and block_vid in vlans_dict and "stp_detail" in vlans_dict[block_vid]:
                vlans_dict[block_vid]["stp_detail"]["stp_interfaces"] = stp_ifaces
                # Also store the BPDU port at the stp_detail level
                if bpdu_port is not None:
                    vlans_dict[block_vid]["stp_detail"]["bpdu_port"] = bpdu_port
        # Remove bpdu_port from stp_detail if it accidentally exists at that level.
        for vlan in vlans_dict.values():
            if "stp_detail" in vlan:
                vlan["stp_detail"].pop("bpdu_port", None)
        # (e) Process LLDP neighbors from the fourth array.
        lldp_neighbors = []
        if lldp_arr:
            lldp_text = "\n".join(lldp_arr)
            for m in lldp_pattern.finditer(lldp_text):
                remote_device = m.group("remote_device").split('.')[0].strip()
                if remote_device.lower() == "device":
                    continue
                lldp_neighbors.append({
                    "local_hostname": hostname,
                    "local_intf": m.group("local_intf").strip(),
                    "remote_device": remote_device,
                    "remote_intf": m.group("port_id").strip()
                })
    
        vlans_list = sorted(vlans_dict.values(), key=lambda x: x["vlan_id"])
        parsed_data.append({
            "hostname": hostname,
            "interfaces": interfaces,
            "vlans": vlans_list,
            "lldp_neighbors": lldp_neighbors
        })
    
    return parsed_data

if __name__ == "__main__":
    sample_output = r"""
ok: [SW101] => {
    "msg": [
        [
            "Interface              IP-Address      OK? Method Status                Protocol",
            "Vlan1                  192.168.110.24  YES NVRAM  up                    down    ",
            "Vlan434                192.168.10.21   YES NVRAM  up                    up      ",
            "FastEthernet0          unassigned      YES NVRAM  administratively down down    ",
            "GigabitEthernet1/0/1   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/2   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/3   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/4   unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/5   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/6   unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/7   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/8   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/9   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/10  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/11  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/12  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/13  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/14  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/15  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/16  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/17  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/18  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/19  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/20  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/21  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/22  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/23  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/24  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/25  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/26  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/27  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/28  unassigned      YES unset  down                  down"
        ],
        [
            "VLAN Name                             Status    Ports",
            "---- -------------------------------- --------- -------------------------------",
            "1    default                          active    Gi1/0/1, Gi1/0/2, Gi1/0/3, Gi1/0/5, Gi1/0/7, Gi1/0/8, Gi1/0/9, Gi1/0/10, Gi1/0/12, Gi1/0/13, Gi1/0/16, Gi1/0/17, Gi1/0/18, Gi1/0/19, Gi1/0/20, Gi1/0/21, Gi1/0/22, Gi1/0/23, Gi1/0/25, Gi1/0/26, Gi1/0/27, Gi1/0/28",
            "200  Puii                             active    ",
            "201  VLAN0201                         active    ",
            "202  VLAN0202                         active    ",
            "203  VLAN0203                         active    ",
            "210  VLAN0210                         active    ",
            "300  VLAN0300                         active    ",
            "434  VLAN0434                         active    Gi1/0/24",
            "1002 fddi-default                     act/unsup ",
            "1003 token-ring-default               act/unsup ",
            "1004 fddinet-default                  act/unsup ",
            "1005 trnet-default                    act/unsup"
        ],
        [
            "VLAN0200",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    4296",
            "             Address     0c11.679a.b000",
            "             This bridge is the root",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    4296   (priority 4096 sys-id-ext 200)",
            "             Address     0c11.679a.b000",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/4             Desg FWD 4         128.4    P2p ",
            "Gi1/0/6             Desg FWD 4         128.6    P2p ",
            "",
            "",
            "",
            "VLAN0203",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32971",
            "             Address     0c11.678c.8700",
            "             Cost        4",
            "             Port        11 (GigabitEthernet1/0/11)",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    32971  (priority 32768 sys-id-ext 203)",
            "             Address     0c11.679a.b000",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/11            Root FWD 4         128.11   P2p ",
            "Gi1/0/15            Altn BLK 4         128.15   P2p ",
            "",
            "",
            "",
            "VLAN0210",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32978",
            "             Address     0c11.678c.8700",
            "             Cost        4",
            "             Port        15 (GigabitEthernet1/0/15)",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    32978  (priority 32768 sys-id-ext 210)",
            "             Address     0c11.679a.b000",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/15            Root FWD 4         128.15   P2p ",
            "",
            "",
            "",
            "VLAN0434",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32768",
            "             Address     64d1.543c.34e6",
            "             Cost        4",
            "             Port        24 (GigabitEthernet1/0/24)",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    33202  (priority 32768 sys-id-ext 434)",
            "             Address     0c11.679a.b000",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/14            Desg FWD 4         128.14   P2p ",
            "Gi1/0/24            Root FWD 4         128.24   P2p"
        ],
        [
            "Capability codes:",
            "    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device",
            "    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other",
            "",
            "Device ID           Local Intf     Hold-time  Capability      Port ID",
            "SW103.eng.cmu.ac.th Gi1/0/6        120        B               Gi1/0/6",
            "SW102.eng.cmu.ac.th Gi1/0/4        120        B               Gi1/0/4",
            "SW102.eng.cmu.ac.th Gi1/0/11       120        B               Gi1/0/11",
            "SW102.eng.cmu.ac.th Gi1/0/14       120        B               Gi1/0/14",
            "SW102.eng.cmu.ac.th Gi1/0/15       120        B               Gi1/0/15",
            "MikroTik            Gi1/0/24       120        B,W,R           bridge1",
            "",
            "Total entries displayed: 6"
        ]
    ]
}
ok: [SW102] => {
    "msg": [
        [
            "Interface              IP-Address      OK? Method Status                Protocol",
            "Vlan1                  unassigned      YES NVRAM  up                    down    ",
            "Vlan434                192.168.10.22   YES NVRAM  up                    up      ",
            "FastEthernet0          unassigned      YES NVRAM  administratively down down    ",
            "GigabitEthernet1/0/1   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/2   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/3   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/4   unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/5   unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/6   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/7   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/8   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/9   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/10  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/11  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/12  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/13  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/14  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/15  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/16  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/17  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/18  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/19  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/20  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/21  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/22  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/23  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/24  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/25  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/26  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/27  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/28  unassigned      YES unset  down                  down"
        ],
        [
            "VLAN Name                             Status    Ports",
            "---- -------------------------------- --------- -------------------------------",
            "1    default                          active    Gi1/0/1, Gi1/0/2, Gi1/0/3, Gi1/0/6, Gi1/0/7, Gi1/0/8, Gi1/0/9, Gi1/0/10, Gi1/0/12, Gi1/0/13, Gi1/0/16, Gi1/0/17, Gi1/0/18, Gi1/0/19, Gi1/0/20, Gi1/0/21, Gi1/0/23, Gi1/0/25, Gi1/0/26, Gi1/0/27, Gi1/0/28",
            "200  Puii                             active    ",
            "201  VLAN0201                         active    ",
            "202  VLAN0202                         active    ",
            "203  VLAN0203                         active    ",
            "210  VLAN0210                         active    ",
            "300  VLAN0300                         active    ",
            "434  VLAN0434                         active    Gi1/0/24",
            "1002 fddi-default                     act/unsup ",
            "1003 token-ring-default               act/unsup ",
            "1004 fddinet-default                  act/unsup ",
            "1005 trnet-default                    act/unsup"
        ],
        [
            "VLAN0200",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    4296",
            "             Address     0c11.679a.b000",
            "             Cost        4",
            "             Port        4 (GigabitEthernet1/0/4)",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    32968  (priority 32768 sys-id-ext 200)",
            "             Address     0c11.678c.8700",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/4             Root FWD 4         128.4    P2p ",
            "Gi1/0/5             Desg FWD 4         128.5    P2p ",
            "",
            "",
            "",
            "VLAN0201",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32969",
            "             Address     0c11.678c.8700",
            "             This bridge is the root",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    32969  (priority 32768 sys-id-ext 201)",
            "             Address     0c11.678c.8700",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/14            Desg FWD 4         128.14   P2p ",
            "",
            "",
            "",
            "VLAN0203",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32971",
            "             Address     0c11.678c.8700",
            "             This bridge is the root",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    32971  (priority 32768 sys-id-ext 203)",
            "             Address     0c11.678c.8700",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/11            Desg FWD 4         128.11   P2p ",
            "Gi1/0/15            Desg FWD 4         128.15   P2p ",
            "",
            "",
            "",
            "VLAN0210",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32978",
            "             Address     0c11.678c.8700",
            "             This bridge is the root",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    32978  (priority 32768 sys-id-ext 210)",
            "             Address     0c11.678c.8700",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/15            Desg FWD 4         128.15   P2p ",
            "",
            "",
            "",
            "VLAN0434",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32768",
            "             Address     64d1.543c.34e6",
            "             Cost        4",
            "             Port        24 (GigabitEthernet1/0/24)",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    33202  (priority 32768 sys-id-ext 434)",
            "             Address     0c11.678c.8700",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/24            Root FWD 4         128.24   P2p"
        ],
        [
            "Capability codes:",
            "    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device",
            "    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other",
            "",
            "Device ID           Local Intf     Hold-time  Capability      Port ID",
            "SW101.eng.cmu.ac.th Gi1/0/11       120        B               Gi1/0/11",
            "SW101.eng.cmu.ac.th Gi1/0/15       120        B               Gi1/0/15",
            "SW101.eng.cmu.ac.th Gi1/0/14       120        B               Gi1/0/14",
            "SW103.eng.cmu.ac.th Gi1/0/5        120        B               Gi1/0/5",
            "SW101.eng.cmu.ac.th Gi1/0/4        120        B               Gi1/0/4",
            "MikroTik            Gi1/0/24       120        B,W,R           bridge1",
            "",
            "Total entries displayed: 6"
        ]
    ]
}
ok: [SW103] => {
    "msg": [
        [
            "Interface              IP-Address      OK? Method Status                Protocol",
            "Vlan1                  unassigned      YES NVRAM  up                    down    ",
            "Vlan434                192.168.10.23   YES NVRAM  up                    up      ",
            "FastEthernet0          unassigned      YES NVRAM  down                  down    ",
            "GigabitEthernet1/0/1   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/2   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/3   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/4   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/5   unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/6   unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/7   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/8   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/9   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/10  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/11  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/12  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/13  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/14  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/15  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/16  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/17  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/18  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/19  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/20  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/21  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/22  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/23  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/24  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/25  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/26  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/27  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/28  unassigned      YES unset  down                  down"
        ],
        [
            "VLAN Name                             Status    Ports",
            "---- -------------------------------- --------- -------------------------------",
            "1    default                          active    Gi1/0/1, Gi1/0/2, Gi1/0/3, Gi1/0/4, Gi1/0/7, Gi1/0/8, Gi1/0/9, Gi1/0/10, Gi1/0/11, Gi1/0/13, Gi1/0/14, Gi1/0/15, Gi1/0/16, Gi1/0/17, Gi1/0/18, Gi1/0/19, Gi1/0/20, Gi1/0/21, Gi1/0/22, Gi1/0/23, Gi1/0/25, Gi1/0/26, Gi1/0/27, Gi1/0/28",
            "200  Puii                             active    ",
            "201  VLAN0201                         active    ",
            "202  VLAN0202                         active    ",
            "203  VLAN0203                         active    ",
            "210  VLAN0210                         active    ",
            "300  VLAN0300                         active    ",
            "434  VLAN0434                         active    Gi1/0/24",
            "1002 fddi-default                     act/unsup ",
            "1003 token-ring-default               act/unsup ",
            "1004 fddinet-default                  act/unsup ",
            "1005 trnet-default                    act/unsup"
        ],
        [
            "VLAN0200",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    4296",
            "             Address     0c11.679a.b000",
            "             Cost        4",
            "             Port        6 (GigabitEthernet1/0/6)",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    32968  (priority 32768 sys-id-ext 200)",
            "             Address     0c11.678d.0480",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/5             Altn BLK 4         128.5    P2p ",
            "Gi1/0/6             Root FWD 4         128.6    P2p ",
            "",
            "",
            "",
            "VLAN0434",
            "  Spanning tree enabled protocol ieee",
            "  Root ID    Priority    32768",
            "             Address     64d1.543c.34e6",
            "             Cost        4",
            "             Port        24 (GigabitEthernet1/0/24)",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "",
            "  Bridge ID  Priority    33202  (priority 32768 sys-id-ext 434)",
            "             Address     0c11.678d.0480",
            "             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec",
            "             Aging Time  300 sec",
            "",
            "Interface           Role Sts Cost      Prio.Nbr Type",
            "------------------- ---- --- --------- -------- --------------------------------",
            "Gi1/0/24            Root FWD 4         128.24   P2p"
        ],
        [
            "Capability codes:",
            "    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device",
            "    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other",
            "",
            "Device ID           Local Intf     Hold-time  Capability      Port ID",
            "SW102.eng.cmu.ac.th Gi1/0/5        120        B               Gi1/0/5",
            "SW101.eng.cmu.ac.th Gi1/0/6        120        B               Gi1/0/6",
            "MikroTik            Gi1/0/24       120        B,W,R           bridge1",
            "",
            "Total entries displayed: 3"
        ]
    ]
}
}
"""
    results = parse_configd(sample_output)
    
    # Write the results to a file for easier inspection.
    with open("results.txt", "w") as outfile:
        outfile.write(json.dumps(results, indent=2))
