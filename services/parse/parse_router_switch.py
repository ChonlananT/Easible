import re

def parse_router_switch(log_text):
    """
    แยกข้อมูลจาก log output ของ Ansible และดึงข้อมูล interface, vlan, (ip, subnet สำหรับ router)
    คืนค่าเป็น list ของ dict โดยแต่ละ dict จะมี key ดังนี้:
      - host: ชื่อ host
      - type: 'switch' หรือ 'router'
      - interface: interface name
      - vlan_id: VLAN id (สำหรับ switch อาจมีหลายค่า)
      - (สำหรับ router) ip_address และ subnet
    """
    regex = r'''(?s)ok: \[([^]]+)\] => \{\s+"msg"\s*:\s*\[\s*\[\s*.*?interface\s+(?P<intf>[^",\s]+).*?(?:(?:switchport trunk allowed vlan\s+(?P<switch_vlan>[\d,]+))|(?:encapsulation dot1Q\s+(?P<router_vlan>\d+).*?ip address\s+(?P<ip>[\d.]+)\s+(?P<subnet>[\d.]+))).*?\]\s*\]\s*\}'''
    
    pattern = re.compile(regex)
    results = []
    
    for match in pattern.finditer(log_text):
        host = match.group(1)
        intf = match.group('intf')
        switch_vlan = match.group('switch_vlan')
        router_vlan = match.group('router_vlan')
        ip = match.group('ip')
        subnet = match.group('subnet')
        
        if switch_vlan is not None:
            result = {
                'host': host,
                'type': 'switch',
                'interface': intf,
                'vlan_id': switch_vlan
            }
        else:
            result = {
                'host': host,
                'type': 'router',
                'interface': intf,
                'vlan_id': router_vlan,
                'ip_address': ip,
                'subnet': subnet
            }
        results.append(result)
        print(result)
    
    return results
