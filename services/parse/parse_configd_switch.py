import re

def parse_configd(output):
    parsed_data = []

    # ---------------------------------------------------
    # 1) แยกข้อความตาม hostname
    #    เราใช้ regex เพื่อจับกลุ่ม hostname กับเนื้อหาที่ตามมา
    # ---------------------------------------------------
    host_blocks = re.split(r'(?s)ok:\s*\[([^\]]+)\]\s*=>\s*\{.*?"msg":\s*\[', output)
    # host_blocks จะได้เป็น list ประมาณ: 
    # [ '', 'SW401', ' ... เนื้อหา ... ', 'SW402', ' ... เนื้อหา ...', ... ]

    # ---------------------------------------------------
    # 2) เตรียม Regex สำหรับดึง interface / ip / status
    # ---------------------------------------------------
    interface_pattern = re.compile(
        r"^\s*([^\s]+)\s+([^\s]+)\s+YES\s+[^\s]+\s+(.+?)\s{2,}",
        re.MULTILINE
    )

    # ---------------------------------------------------
    # 3) เตรียม Regex สำหรับดึงข้อมูล STP (เช่น root_mac, bridge_mac)
    #    โดยจับเฉพาะ VLANXXXX แล้วตามด้วยเนื้อหา STP
    # ---------------------------------------------------
    vlan_info_pattern = re.compile(
        r'''
        "VLAN(?P<vlan>\d+)                     # เช่น "VLAN300"
        .*?Root\s+ID\s+Priority\s+\d+         # ข้าม Root Priority
        .*?Address\s+(?P<root_addr>[0-9A-Fa-f\.]+)    # MAC ของ Root
        .*?Bridge\s+ID\s+Priority\s+\d+       # ข้าม Bridge Priority ส่วนต้น
        \s+\(priority\s+(?P<bridge_pri_paren>\d+)     # เก็บ Priority ในวงเล็บ
        .*?\)                                 # ปิดวงเล็บ
        .*?Address\s+(?P<bridge_addr>[0-9A-Fa-f\.]+)  # MAC ของ Bridge
        ''',
        re.DOTALL | re.VERBOSE
    )

    # ---------------------------------------------------
    # 4) วนลูปทีละโฮสต์ (ข้าม index 0 เพราะเป็นค่าว่าง)
    # ---------------------------------------------------
    for i in range(1, len(host_blocks), 2):
        hostname = host_blocks[i].strip()     
        data = host_blocks[i + 1]             # เนื้อหาของโฮสต์นั้น ๆ

        # 4.1) ดึงข้อมูล Interface
        interface_list = []
        for line in interface_pattern.findall(data):
            interface, ip_address, status = line
            interface = interface.strip('"')   # เผื่อมีเครื่องหมาย " 
            # จัดการ status ถ้าเป็น admin down
            if "administratively down" in status:
                status = "administratively down"
            interface_list.append({
                "interface": interface,
                "detail": {
                    "ip_address": ip_address,
                    "status": status.strip()
                }
            })

        # 4.2) ดึง VLAN ID จากส่วนที่เป็น show vlan brief (แบบง่าย ๆ)
        #     ตย. regex ด้านล่างอาจต้องปรับแก้ตามรูปแบบจริง
        vlan_lines = re.findall(
            r"(?<![a-zA-Z\/\.])\b(\d+)\b\s+[^\n]+(.*?)(?=act)",
            data, 
            re.MULTILINE
        )
        # สร้างโครงสร้าง vlans = [{ "vlan_id": <num> }, ... ]
        vlans_dict = {}
        for m in vlan_lines:
            vlan_id = int(m[0])
            if vlan_id not in vlans_dict:
                vlans_dict[vlan_id] = {
                    "vlan_id": vlan_id
                }

        # 4.3) ดึงข้อมูล STP ถ้ามี
        stp_detail_list = []
        for match in vlan_info_pattern.finditer(data):
            vlan_id = int(match.group('vlan'))
            root_mac = match.group('root_addr')
            bridge_pri_paren = match.group('bridge_pri_paren')
            bridge_mac = match.group('bridge_addr')

            # ถ้า root_mac == bridge_mac => isRoot = True
            is_root = (root_mac.lower() == bridge_mac.lower())

            stp_detail_list.append({
                'vlan': vlan_id,
                'root_mac': root_mac,
                'bridge_priority_in_brackets': bridge_pri_paren,
                'bridge_mac': bridge_mac,
                'isRoot': is_root
            })

        # 4.4) ผนวก stp_detail เข้ากับ vlans_dict เฉพาะ VLAN ที่เจอ
        for stp in stp_detail_list:
            vid = stp["vlan"]
            if vid not in vlans_dict:
                # ถ้าเจอ STP VLAN แต่ไม่เจอใน vlan_lines มาก่อน
                # อาจต้องสร้างใหม่ (เผื่อว่ามี VLAN ที่ active แต่ไม่ได้โชว์ใน brief)
                vlans_dict[vid] = {"vlan_id": vid}
            # ใส่ stp_detail เข้าไปเป็นลูก
            vlans_dict[vid]["stp_detail"] = {
                "root_mac": stp["root_mac"],
                "bridge_priority_in_brackets": stp["bridge_priority_in_brackets"],
                "bridge_mac": stp["bridge_mac"],
                "isRoot": stp["isRoot"]
            }

        # สร้าง list ของ vlans เรียงจาก dict (จะ sort หรือไม่ก็ได้)
        vlans_list = list(vlans_dict.values())
        # ถ้าอยาก sort ตาม vlan_id ก็ทำได้ เช่น:
        # vlans_list.sort(key=lambda x: x["vlan_id"])

        # สุดท้ายสรุปข้อมูลของโฮสต์นี้ลงใน parsed_data
        parsed_data.append({
            "hostname": hostname,
            "interfaces": interface_list,
            "vlans": vlans_list
        })

    return parsed_data