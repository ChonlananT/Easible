import re

def parse_switch_host(output):
    """
    ทำการ parse output จาก ansible playbook เพื่อดึงข้อมูล host, interface, VLAN, IP address และ subnet mask
    โดยใช้ regular expression ที่กำหนดไว้

    :param output: ข้อความ output จาก ansible playbook (string)
    :return: รายการของ dictionary ที่มี key: host, interface, vlan, ip_address, subnet_mask
    """
    # ปรับ pattern ให้รองรับกรณีที่ไม่มี ip address (จับ "no ip address") ด้วย non-capturing group
    pattern = (
        r'(?s)ok: \[([^]]+)\] => \{\s+"msg"\s*:\s*\[\s*\[\s*.*?interface\s+([^\n]+)'
        r'.*?switchport access vlan\s+(\d+).*?\]\s*,\s*\[\s*.*?(?:ip address\s+([\d\.]+)\s+([\d\.]+)|no ip address)'
        r'.*?\]\s*\]\s*\}'
    )
    
    matches = re.findall(pattern, output)
    results = []
    for match in matches:
        host, interface, vlan, ip_address, subnet_mask = match
        # ทำความสะอาด string interface ด้วยการลบเครื่องหมาย " และ , ที่ติดมาด้วย
        cleaned_interface = interface.strip('", ')
        # หากไม่พบ ip address (จับ "no ip address" แล้วกลุ่มที่เกี่ยวข้องจะเป็น empty string)
        if not ip_address:
            ip_address = None
            subnet_mask = None
        results.append({
            "host": host,
            "interface": cleaned_interface,
            "vlan": vlan,
            "ip_address": ip_address,
            "subnet_mask": subnet_mask
        })
    
    return results