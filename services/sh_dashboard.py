def sh_dashboard():
    hosts_line = "Alldevice"
    
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
            
      - name: Display interface details
        debug:
          msg: "Good!"
    """
    
    return playbook_content
