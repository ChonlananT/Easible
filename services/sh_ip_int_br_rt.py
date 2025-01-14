from services.database import fetch_all_devices

def sh_ip_int_br_rt():
    # ดึงข้อมูลอุปกรณ์ทั้งหมดจากฐานข้อมูล
    devices = fetch_all_devices()
    
    # กรองเฉพาะอุปกรณ์ที่มี deviceType เป็น 'router'
    switch_devices = [device for device in devices if device.get("deviceType") == "router"]
    
    # ดึงเฉพาะ hostname ของอุปกรณ์ประเภท router
    router_hostnames = [device.get("hostname") for device in switch_devices]
    
    # ตรวจสอบว่าเจออุปกรณ์ประเภท router หรือไม่
    if not router_hostnames:
        return "# ไม่พบอุปกรณ์ประเภท router ในฐานข้อมูล"
    
    # รวม hostname เข้าด้วยกันเป็นสตริงที่คั่นด้วยเครื่องหมายจุลภาค
    hosts_line = ", ".join(router_hostnames)
    
    # สร้างเนื้อหา Playbook โดยใช้ hostname ที่กรองแล้ว
    playbook_content = f"""
---
  - name: Show IP Interface Brief on Routers
    hosts: {hosts_line}
    gather_facts: no
    tasks:
      - name: Run 'show ip interface brief' commands
        ios_command:
          commands:
            - show ip interface brief
        register: interface_output

      - name: Display interface details
        debug:
          msg: "{{{{ interface_output.stdout_lines }}}}"
    """
    
    return playbook_content
