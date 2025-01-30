from services.database import fetch_all_devices

def sh_ip_int_br():
    hosts_line = "selectedgroup"
    
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
