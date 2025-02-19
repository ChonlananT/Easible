import re
import json

def parse_routes(data):
    # ดึง host name จาก pattern "ok: [host] => {"
    host_match = re.search(r'ok:\s*\[([^]]+)\]\s*=>\s*\{', data)
    if not host_match:
        raise ValueError("ไม่พบ host ในข้อมูล")
    host = host_match.group(1)
    
    # ดึงบรรทัดทั้งหมดที่อยู่ใน double quotes
    lines = re.findall(r'"(.*?)"', data, re.DOTALL)
    
    # หาตำแหน่งบรรทัดที่มี "Gateway of last resort is not set"
    start_index = None
    for i, line in enumerate(lines):
        if "Gateway of last resort is not set" in line:
            start_index = i
            break
    if start_index is None:
        raise ValueError("ไม่พบบรรทัด 'Gateway of last resort is not set'")
    
    # ข้อมูล route อยู่หลังจากบรรทัด "Gateway of last resort is not set"
    route_lines = lines[start_index+1:]
    
    # กำหนด mapping สำหรับ protocol: O => ospf, C => none, R => ripv2
    proto_map = {
        'O': 'ospf',
        'C': 'none',
        'R': 'ripv2'
    }
    
    routes = []
    
    # regex สำหรับจับข้อมูลจากแต่ละ route line
    # รูปแบบตัวอย่าง:
    #   R        192.168.3.0/24 [120/1] via 192.168.1.1, 00:00:18, Serial0/0/0
    #   C        192.168.10.0/24 is directly connected, GigabitEthernet0/0
    route_regex = re.compile(
        r'^(?P<proto>[OCR])\s+'                       # protocol letter (O, C, R)
        r'(?P<network>\d+\.\d+\.\d+\.\d+\/\d+)'        # network in CIDR
        r'(?:.*?via\s+(?P<nexthop>\d+\.\d+\.\d+\.\d+))?' # optional: nexthop after "via"
        r'.*?,\s*(?P<intf>\S+)\s*$',                   # interface (ท้ายบรรทัด หลัง comma)
        re.IGNORECASE
    )
    
    for line in route_lines:
        line = line.strip()
        if not line:
            continue  # ข้ามบรรทัดว่าง
        
        m = route_regex.search(line)
        if m:
            proto_letter = m.group("proto").upper()
            if proto_letter not in proto_map:
                continue  # ข้ามถ้าไม่ได้อยู่ใน O, C, R
            protocol = proto_map[proto_letter]
            
            network = m.group("network")
            # แยก ip address และ subnet จาก network (CIDR)
            if '/' in network:
                ip_address, subnet = network.split('/', 1)
            else:
                ip_address = network
                subnet = ""
            
            nexthop = m.group("nexthop")
            # ถ้า protocol เป็น C และไม่พบ nexthop (หรือ m.group("nexthop") เป็น None)
            # กำหนด nexthop เป็น "directly"
            if proto_letter == 'C' and not nexthop:
                nexthop = "directly"
            
            interface = m.group("intf")
            
            route_entry = {
                "protocol": protocol,
                "ip_address": ip_address,
                "subnet": subnet,
                "nexthop": nexthop,
                "interface": interface
            }
            routes.append(route_entry)
    
    # รวมผลลัพธ์ในรูปแบบ dict โดยใช้ host เป็น key
    result = { host: routes }
    return result