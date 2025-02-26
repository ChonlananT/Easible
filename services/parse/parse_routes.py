import re
import json

def parse_routes(data):
    """
    Parse multiple 'ok: [HostName] => { ... }' blocks from `data` and
    return a dictionary mapping each host to its list of parsed routes.
    """
    # Regex to find each host block:
    #   ok: [R101] => {
    #       "msg": [
    #           [
    #               ...
    #           ]
    #       ]
    #   }
    block_pattern = re.compile(
        r'ok:\s*\[(?P<host>[^\]]+)\]\s*=>\s*\{\s*"msg"\s*:\s*\[\s*\[\s*(?P<block>.*?)\]\s*\]\s*\}',
        re.DOTALL
    )

    # Protocol mapping
    proto_map = {
        'C': 'Connected',
        'O': 'OSPF',
        'R': 'RIPv2'
    }

    header_regex = re.compile(
        r'^\s*(?P<header_subnet>\d+\.\d+\.\d+\.\d+/\d+)\s+is subnetted', re.IGNORECASE
    )

    # Regex to match route lines:
    #
    # Examples of lines we want to capture:
    #   C        192.168.10.0/24 is directly connected, GigabitEthernet0/0
    #   O        192.168.69.4/30 [110/128] via 192.168.69.2, 00:49:07, Serial0/1/0
    #   R        192.168.4.0/30 [120/1] via 192.168.1.1, 00:00:18, Serial0/0/0
    #
    # Explanation:
    #   ^(?P<proto>[COR])\s+               => Leading protocol letter (C/O/R)
    #   (?P<subnet>\d+\.\d+\.\d+\.\d+/\d+) => The subnet in CIDR
    #   (?:.*?via\s+(?P<nexthop>\d+\.\d+\.\d+\.\d+))?
    #       => optionally capture the IP after 'via' if present
    #   .*?,\s*(?P<intf>\S+)\s*$           => capture the outgoing interface at the end of line, after a comma
    route_regex = re.compile(
        r'^(?P<proto>[COR])\s+'
        r'(?P<subnet>\d+\.\d+\.\d+\.\d+(?:/\d+)?)'
        r'(?:.*?via\s+(?P<nexthop>\d+\.\d+\.\d+\.\d+))?'
        r'.*?,\s*(?P<intf>\S+)\s*$',
        re.IGNORECASE
    )

    results = {}  # will map host -> list of routes

    # Find all host blocks in the data
    for match in block_pattern.finditer(data):
        host = match.group("host")
        block_text = match.group("block")  # all lines inside the "msg": [[ ... ]]

        # Pull out all double-quoted lines from the block
        lines = re.findall(r'"(.*?)"', block_text, re.DOTALL)

        # Find the line "Gateway of last resort is not set"
        start_index = None
        for i, line in enumerate(lines):
            if "Gateway of last resort is not set" in line:
                start_index = i
                break

        # If not found, skip or raise an error. Here we skip if there's no gateway line.
        if start_index is None:
            continue

        # Everything after the gateway line is the route info
        route_lines = lines[start_index+1:]

        host_routes = []
        current_header_mask = None  # เก็บ subnet mask จาก header ล่าสุด

        for line in route_lines:
            line = line.strip()
            if not line:
                continue

            # หากเป็นบรรทัด header ที่บอก subnet mask (เช่น "1.0.0.0/30 is subnetted,...")
            header_match = header_regex.match(line)
            if header_match:
                current_header_mask = header_match.group("header_subnet").split('/')[-1]
                continue

            m = route_regex.search(line)
            if not m:
                # ถ้าไม่ match route line ให้ข้าม
                continue

            proto_letter = m.group("proto").upper()
            if proto_letter not in proto_map:
                continue

            protocol = proto_map[proto_letter]
            subnet = m.group("subnet")
            nexthop = m.group("nexthop")
            # สำหรับ connected routes ถ้าไม่มี nexthop กำหนดเป็น "directly"
            if proto_letter == 'C' and not nexthop:
                nexthop = "directly"

            outgoing_intf = m.group("intf")

            # ถ้า protocol เป็น OSPF หรือ RIP แล้ว subnet ที่จับมาไม่มี mask (ไม่มี '/' ใน subnet)
            if proto_letter in ['O', 'R'] and '/' not in subnet:
                if current_header_mask:
                    subnet = f"{subnet}/{current_header_mask}"

            route_entry = {
                "nexthop": nexthop,
                "outgoing_interface": outgoing_intf,
                "protocol": protocol,
                "subnet": subnet
            }
            host_routes.append(route_entry)

        results[host] = host_routes

    return results

