import re
from collections import defaultdict, deque

def build_lldp_mapping(fetched_data):
    """
    Build a dictionary mapping (hostname, local_intf) -> link_id
    by looking at LLDP neighbors in each device's data.
    Example link_id = "SW101_Gi1/0/4_SW102_Gi1/0/4"
    """
    mapping = {}
    for device in fetched_data:
        hostname = device.get("hostname", "").strip()
        lldp_neighbors = device.get("lldp_neighbors", [])
        
        for nbr in lldp_neighbors:
            local_intf = nbr.get("local_intf", "").strip()
            remote_device = nbr.get("remote_device", "").strip()
            remote_intf = nbr.get("remote_intf", "").strip()
            
            if not (hostname and local_intf and remote_device and remote_intf):
                continue
            
            # Sort the endpoints so the link_id is consistent
            ep1 = (hostname, local_intf)
            ep2 = (remote_device, remote_intf)
            sorted_eps = sorted([ep1, ep2])
            link_id = f"{sorted_eps[0][0]}_{sorted_eps[0][1]}_{sorted_eps[1][0]}_{sorted_eps[1][1]}"
            
            # Map both endpoints to the same link_id
            mapping[ep1] = link_id
            mapping[ep2] = link_id
    return mapping


def get_link_id(interface_name):
    """
    Fallback function if no link_id or LLDP mapping is found.
    Strips leading letters from the interface name.
    Example: "GigabitEthernet1/0/5" -> "1/0/5"
    """
    if not interface_name:
        return ""
    return re.sub(r'^[A-Za-z]+', '', interface_name)


def calculate_root_paths(vlan_switches, adjacency, root_hostname):
    """
    Perform a BFS from the root switch to assign each switch's:
      - rootPathCost (sum of link costs from the root)
      - rootPort (which interface on the switch leads to the root)
    """
    # Initialize everyone to "infinity" path cost
    for sw in vlan_switches:
        sw["rootPathCost"] = float('inf')
        sw["rootPort"] = None
    
    # Find the root switch object
    root_sw = next((s for s in vlan_switches if s["hostname"] == root_hostname), None)
    if not root_sw:
        return  # Edge case: if we don't find the root, do nothing
    root_sw["rootPathCost"] = 0
    
    queue = deque([root_hostname])
    
    while queue:
        current_host = queue.popleft()
        current_sw = next((s for s in vlan_switches if s["hostname"] == current_host), None)
        if not current_sw:
            continue
        
        current_cost = current_sw["rootPathCost"]
        
        # Look at each neighbor from adjacency
        neighbors = adjacency.get(current_host, [])
        for nbr_info in neighbors:
            neighbor_host = nbr_info["neighbor"]
            link_cost = nbr_info["cost"]
            new_cost = current_cost + link_cost
            
            neighbor_sw = next((s for s in vlan_switches if s["hostname"] == neighbor_host), None)
            if not neighbor_sw:
                continue
            
            # If we found a better path to the root, update
            if new_cost < neighbor_sw["rootPathCost"]:
                neighbor_sw["rootPathCost"] = new_cost
                # The neighbor's rootPort is the interface facing "current_host"
                neighbor_sw["rootPort"] = nbr_info["neighbor_intf"]
                queue.append(neighbor_host)


def mark_root_ports(vlan_switches):
    """
    After calculate_root_paths is done, mark each switch's 'is_root_port' = True
    for the interface that matches sw['rootPort'].
    """
    for sw in vlan_switches:
        rp = sw.get("rootPort")
        for intf in sw["stp_interfaces"]:
            intf["is_root_port"] = (intf["interface"] == rp)


def recalc_stp(fetched_data, vlan_id, selected_hostname, new_priority, lldp_mapping=None):
    """
    Recompute STP roles for a given VLAN using a BFS approach.
    - Builds adjacency from either link_id or LLDP
    - Determines root based on (priority, MAC)
    - Uses BFS to assign each switch's rootPort and rootPathCost
    - Marks designated/alternate ports
    """
    # 1) Build LLDP mapping if not provided
    if lldp_mapping is None:
        lldp_mapping = build_lldp_mapping(fetched_data)
    
    # 2) Gather all switches for this VLAN
    vlan_switches = []
    for device in fetched_data:
        hostname = device.get("hostname")
        for vlan in device.get("vlans", []):
            if vlan.get("vlan_id") == vlan_id and vlan.get("stp_detail"):
                stp_detail = vlan["stp_detail"]
                raw_priority = stp_detail.get("bridge_priority_in_brackets", "32768")
                # Convert "32768" or "4096" to int
                priority = int(re.sub(r'\D', '', raw_priority))
                
                if hostname == selected_hostname:
                    priority = new_priority  # override if this is the chosen device
                
                vlan_switches.append({
                    "hostname": hostname,
                    "vlan_id": vlan_id,
                    "bridge_priority": priority,
                    "bridge_priority_in_brackets": str(priority),
                    "bridge_mac": stp_detail.get("bridge_mac"),
                    "root_mac": stp_detail.get("root_mac"),
                    "isRoot": False,  # Will recalc below
                    "stp_interfaces": stp_detail.get("stp_interfaces", [])
                })
    
    if not vlan_switches:
        return {"error": f"No device found for VLAN {vlan_id}"}
    
    # 3) Determine the new root switch by (priority, MAC)
    new_root = min(vlan_switches, key=lambda sw: (sw["bridge_priority"], sw["bridge_mac"]))
    new_root_mac = new_root["bridge_mac"]
    
    # 4) Initialize some fields
    for sw in vlan_switches:
        sw["isRoot"] = (sw["bridge_mac"] == new_root_mac)
        sw["root_mac"] = new_root_mac
        for p in sw["stp_interfaces"]:
            p["cost"] = int(p.get("cost", 0))
            p["is_root_port"] = False
            p["interface_role"] = None
    
    # 5) Build a segments dictionary, grouping ports by link_id
    segments = defaultdict(list)
    for sw in vlan_switches:
        for intf in sw["stp_interfaces"]:
            key = (sw["hostname"], intf["interface"])
            # Use link_id from interface or from LLDP or fallback
            link_id = (intf.get("link_id")
                       or lldp_mapping.get(key)
                       or get_link_id(intf["interface"]))
            segments[link_id].append((sw, intf))
    
    # 6) Build adjacency for BFS
    adjacency = defaultdict(list)
    for link_id, endpoints in segments.items():
        # If more than 2 endpoints share link_id, they're all neighbors
        for i in range(len(endpoints)):
            for j in range(i + 1, len(endpoints)):
                sw_i, intf_i = endpoints[i]
                sw_j, intf_j = endpoints[j]
                adjacency[sw_i["hostname"]].append({
                    "neighbor": sw_j["hostname"],
                    "local_intf": intf_i["interface"],
                    "neighbor_intf": intf_j["interface"],
                    "cost": intf_i["cost"]
                })
                adjacency[sw_j["hostname"]].append({
                    "neighbor": sw_i["hostname"],
                    "local_intf": intf_j["interface"],
                    "neighbor_intf": intf_i["interface"],
                    "cost": intf_j["cost"]
                })
    
    # 7) BFS to figure out each switch's total cost and root port
    root_hostname = new_root["hostname"]
    calculate_root_paths(vlan_switches, adjacency, root_hostname)
    
    # 8) Mark root_port on each switch
    mark_root_ports(vlan_switches)
    
    # 9) Decide designated vs. alternate per segment
    def designated_candidate_key(item):
        sw, intf = item
        # prefer lower rootPathCost -> lower priority -> lower MAC
        return (sw["rootPathCost"], sw["bridge_priority"], sw["bridge_mac"])
    
    for link_id, endpoints in segments.items():
        if not endpoints:
            continue
        # The port with the "best" (lowest) path to root is designated
        designated_sw, designated_intf = min(endpoints, key=designated_candidate_key)
        designated_intf["interface_role"] = "Designated"
        
        for sw, intf in endpoints:
            # skip the newly assigned designated port
            if sw is designated_sw and intf is designated_intf:
                continue
            if intf.get("is_root_port"):
                intf["interface_role"] = "Root"
            else:
                intf["interface_role"] = "Alternate (BLK)"
    
    # 10) Build final result
    stp_results = []
    for sw in vlan_switches:
        stp_interfaces_out = []
        for p in sw["stp_interfaces"]:
            # convert cost back to string
            p_out = dict(p)
            p_out["cost"] = str(p_out["cost"])
            stp_interfaces_out.append(p_out)
        
        stp_results.append({
            "hostname": sw["hostname"],
            "vlan_id": sw["vlan_id"],
            "stp_detail": {
                "root_mac": sw["root_mac"],
                "bridge_priority_in_brackets": sw["bridge_priority_in_brackets"],
                "bridge_mac": sw["bridge_mac"],
                "isRoot": (sw["hostname"] == root_hostname),
                "stp_interfaces": stp_interfaces_out
            }
        })
    
    return stp_results
