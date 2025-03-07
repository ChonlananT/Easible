def sh_ip_route():
    hosts_line = "selectedgrouprouter"
    
    # สร้างเนื้อหา Playbook โดยใช้ hostname ที่กรองแล้ว
    playbook_content = f"""
---
  - name: Show IP Interface Brief on Switches
    hosts: {hosts_line}
    gather_facts: no
    tasks:
      - name: Run 'show ip route' commands
        ios_command:
          commands:
            - show ip route
        register: interface_output

      - name: Display 'show ip route' Command Details
        debug:
          msg: "{{{{ interface_output.stdout_lines }}}}"
"""
    
    return playbook_content
