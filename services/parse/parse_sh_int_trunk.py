import re
import json

def process_vlan_token(token):
    vlans = []
    # แยกด้วย comma ก่อน
    for part in token.split(','):
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            # ถ้ามีเครื่องหมาย '-' ให้แยก range ออกมา
            try:
                start_str, end_str = part.split('-', 1)
                start = int(start_str.strip())
                end = int(end_str.strip())
                # เพิ่มค่า VLAN ทีละตัวใน range (รวมทั้ง start และ end)
                vlans.extend(list(range(start, end + 1)))
            except ValueError:
                # หากไม่สามารถแปลงเป็นตัวเลขได้ ให้นำ token เดิมไปใช้
                vlans.append(part)
        else:
            try:
                vlans.append(int(part))
            except ValueError:
                vlans.append(part)
    return vlans

def parse_sh_int_trunk(output):
    # Regex pattern สำหรับจับ block "Vlans allowed on trunk" ภายใน msg list
    pattern = re.compile(
        r'''(?sx)                                   # s: dotall, x: verbose
        ok:\s*\[([^]]+)\]\s*=>\s*\{                  # จับ hostname ใน group 1
        \s*"msg"\s*:\s*\[\s*\[                      # จับส่วนเริ่มต้นของ msg array
        (?:(?!Vlans\ allowed\ on\ trunk",).)*?       # ข้ามข้อมูลจนพบ "Vlans allowed on trunk",
        Vlans\ allowed\ on\ trunk",\s*\n             # จับ header line ที่มี "Vlans allowed on trunk",
        (.*?)                                      # จับข้อมูล trunk block ใน group 2 (non-greedy)
        (?=\n\s*""\s*,)                            # หยุดเมื่อเจอบรรทัดที่เป็น empty ("")
        ''')
    
    result = {}
    for match in pattern.finditer(output):
        host = match.group(1).strip()
        trunk_block = match.group(2)
        
        # แยกบรรทัดใน trunk_block แล้วทำความสะอาดข้อมูล
        lines = []
        for line in trunk_block.splitlines():
            # ลบช่องว่าง และอักขระ " กับ ,
            clean_line = line.strip().strip('",')
            if clean_line:
                lines.append(clean_line)

        interfaces = {}
        for line in lines:
            # สมมติรูปแบบของบรรทัดเป็น: "Gi1/0/4     200" หรือ "Gi1/0/13    201-202,300"
            tokens = line.split()
            if not tokens:
                continue
            interface = tokens[0]
            vlan_list = []
            # tokens[1:] อาจจะรวมกันเป็น token เดียวในกรณีที่มี comma อยู่แล้ว
            for token in tokens[1:]:
                vlan_list.extend(process_vlan_token(token))
            interfaces[interface] = {"vlan": vlan_list}
        
        result[host] = {"interfaces": interfaces}
    
    return result