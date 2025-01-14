from services.database import fetch_all_devices

def sh_ip_int_br():
    # ดึงข้อมูลอุปกรณ์ทั้งหมดจากฐานข้อมูล
    devices = fetch_all_devices()
    
    # กรองเฉพาะอุปกรณ์ที่มี deviceType เป็น 'switch'
    switch_devices = [device for device in devices if device.get("deviceType") == "switch"]
    
    # ดึงเฉพาะ hostname ของอุปกรณ์ประเภท switch
    switch_hostnames = [device.get("hostname") for device in switch_devices]
    
    # ตรวจสอบว่าเจออุปกรณ์ประเภท switch หรือไม่
    if not switch_hostnames:
        return "# ไม่พบอุปกรณ์ประเภท switch ในฐานข้อมูล"
    
    # รวม hostname เข้าด้วยกันเป็นสตริงที่คั่นด้วยเครื่องหมายจุลภาค
    hosts_line = ", ".join(switch_hostnames)
    
    # สร้างเนื้อหา Playbook โดยใช้ hostname ที่กรองแล้ว
    playbook_content = f"""
---
  - name: Show IP Interface Brief on Switches
    hosts: {hosts_line}
    gather_facts: no
    tasks:
      - name: Run 'show ip interface brief' and 'show vlan brief' commands
        ios_command:
          commands:
            - show ip interface brief
            - show vlan brief
        register: interface_output

      - name: Display interface details
        debug:
          msg: "{{{{ interface_output.stdout_lines }}}}"
    """
    
    return playbook_content
