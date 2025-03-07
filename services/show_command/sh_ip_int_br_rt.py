def sh_ip_int_br_rt():
    hosts_line = "selectedgrouprouter"
    
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

      - name: Display 'show ip interface brief' Command Details
        debug:
          msg: "{{{{ interface_output.stdout_lines }}}}"
    """
    
    return playbook_content
