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
            status = parts[4]
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