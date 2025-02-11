import re

def parse_interface(output):
    parsed_data = []
    
    # If "PLAY RECAP" is present, only consider output before it.
    if "PLAY RECAP" in output:
        output = output.split("PLAY RECAP")[0]

    # Split the output by hosts
    host_blocks = re.split(r"ok: \[([^\]]+)\]", output)
    
    # Host blocks alternate: empty string, hostname, data
    for i in range(1, len(host_blocks), 2):
        hostname = host_blocks[i].strip()
        data = host_blocks[i + 1]

        # Extract lines with interface details
        lines = re.findall(r"^\s*([^\s]+)\s+([^\s]+)\s+YES\s+[^\s]+\s+(.+?)\s{2,}", data, re.MULTILINE)
        interface_list = []
        for line in lines:
            interface, ip_address, status = line
            interface = interface.strip('"')
            # Handle "administratively down"
            if "administratively down" in status:
                status = "administratively down"
            interface_list.append({
                "interface": interface,
                "detail": {
                    "ip_address": ip_address,
                    "status": status.strip()
                }
            })
        vlan_lines = re.findall(r"(?<![a-zA-Z\/\.])\b(\d+)\b\s+[^\n]+", data, re.MULTILINE)
        vlan_ids = [int(vlan_id) for vlan_id in vlan_lines]
        
        # Only add host if interface_list is not empty
        if interface_list:
            parsed_data.append({
                "hostname": hostname,
                "interfaces": interface_list,
                "vlan_ids": vlan_ids
            })
    
    return parsed_data