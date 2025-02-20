def convert_mask_to_cidr(mask):
    """
    แปลง subnet mask (เช่น 255.255.255.252) ให้เป็นตัวเลข CIDR (เช่น 30)
    """
    try:
        parts = mask.split('.')
        bits = ''.join([bin(int(x)).lstrip('0b').zfill(8) for x in parts])
        cidr = str(bits.count('1'))
        return cidr
    except Exception as e:
        raise ValueError(f"Invalid subnet mask format: {mask}") from e

def compare_switch_host(frontend_data, parsed_result):
    """
    เปรียบเทียบข้อมูลที่ส่งมาจาก frontend กับ parsed_result จาก playbook
    โดยจะแปลง subnet mask ใน parsed_result ให้เป็น CIDR ก่อนเปรียบเทียบ

    :param frontend_data: รายการข้อมูลจาก frontend โดยมีรูปแบบ:
        [
            {
              "hostname": <host>,
              "interfaces": [
                  {
                    "interface": <interface>,
                    "vlanId": <vlan>,
                    "ipAddress": <ip_address>,
                    "subnetMask": <cidr subnet>  # ตัวอย่างเช่น "/30"
                  },
                  ...
              ]
            },
            ...
        ]
    :param parsed_result: รายการของ dictionary ที่มี key: host, interface, vlan, ip_address, subnet_mask
           (subnet_mask ในรูปแบบ dotted-decimal เช่น "255.255.255.252")
    :return: รายการผลการเปรียบเทียบ โดยแสดงข้อมูลแต่ละ host และ interface ว่าตรงกันหรือไม่
    """
    # จัดกลุ่ม parsed_result ตาม host และแปลง subnet mask ให้เป็น CIDR
    parsed_by_host = {}
    for entry in parsed_result:
        host = entry['host']
        # แปลง subnet mask จาก dotted-decimal เป็น CIDR
        cidr = convert_mask_to_cidr(entry['subnet_mask'])
        entry_cidr = entry.copy()
        entry_cidr['subnet_mask'] = cidr
        parsed_by_host.setdefault(host, []).append(entry_cidr)
    
    comparisons = []
    # วนลูปข้อมูลของแต่ละ host ใน frontend_data
    for host_entry in frontend_data:
        hostname = host_entry['hostname']
        frontend_interfaces = host_entry.get('interfaces', [])
        parsed_interfaces = parsed_by_host.get(hostname, [])
        host_comparison = {"hostname": hostname, "interfaces": []}
        
        # เปรียบเทียบข้อมูลของแต่ละ interface
        for frontend_iface in frontend_interfaces:
            matched = None
            for parsed_iface in parsed_interfaces:
                # เปรียบเทียบโดยใช้ชื่อ interface (สามารถปรับ normalization ได้หากจำเป็น)
                if parsed_iface.get('interface').strip() == frontend_iface.get('interface').strip():
                    matched = parsed_iface
                    break

            interface_result = {
                "matched": matched is not None,
                "interface": frontend_iface.get('interface'),
                "frontend": frontend_iface,
                "parsed": matched if matched is not None else None
            }
            host_comparison["interfaces"].append(interface_result)
        comparisons.append(host_comparison)
    
    return comparisons