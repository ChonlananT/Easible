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
        r'(?P<subnet>\d+\.\d+\.\d+\.\d+/\d+)'
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
        for line in route_lines:
            line = line.strip()
            if not line:
                continue

            m = route_regex.search(line)
            if not m:
                # It's often a local (L) route or something else. We skip it.
                continue

            proto_letter = m.group("proto").upper()
            if proto_letter not in proto_map:
                # skip lines for protocols we don't map (e.g. L, S, etc.)
                continue

            protocol = proto_map[proto_letter]
            subnet = m.group("subnet")
            nexthop = m.group("nexthop")
            if proto_letter == 'C' and not nexthop:
                # For connected routes, if there's no "via x.x.x.x"
                nexthop = "directly"

            outgoing_intf = m.group("intf")

            route_entry = {
                "nexthop": nexthop,
                "outgoing_interface": outgoing_intf,
                "protocol": protocol,
                "subnet": subnet
            }
            host_routes.append(route_entry)

        results[host] = host_routes

    return results

