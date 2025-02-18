def sh_int_trunk():
    hosts_line = "selectedgroupswitch"
    
    # สร้างเนื้อหา Playbook โดยใช้ hostname ที่กรองแล้ว
    playbook_content = f"""
---
  - name: Show IP Interface Brief on Switches
    hosts: {hosts_line}
    gather_facts: no
    tasks:
      - name: Run 'show interface trunk' commands
        ios_command:
          commands:
            - show interface trunk
        register: interface_output

      - name: Display interface details
        debug:
          msg: "{{{{ interface_output.stdout_lines }}}}"
"""
    
    return playbook_content
