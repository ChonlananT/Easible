import re

def parse_switchport(output):
    parsed_data = []

    # Split the output by hosts
    host_blocks = re.split(r"ok: \[([^\]]+)\]", output)
    
    # Host blocks alternate: empty string, hostname, data
    for i in range(1, len(host_blocks), 2):
        hostname = host_blocks[i].strip()
        data = host_blocks[i + 1]

        # Extract interface and switchport mode details
        interface_data = re.findall(
            r"interface (\S+)\s+.*?switchport mode (\w+)",
            data,
            re.DOTALL
        )
        for interface, switchport in interface_data:
            parsed_data.append({
                "hostname": hostname,
                "interface": interface,
                "switchport": switchport
            })
    
    return parsed_data
