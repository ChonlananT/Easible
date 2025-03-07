def sh_swtort(): 
    # สร้างเนื้อหา Playbook โดยใช้ hostname ที่กรองแล้ว
    playbook_content = f"""
---
  - name: Show IP Interface Brief on Switches and Routers
    hosts: selectedgroup
    gather_facts: no
    tasks:
      - name: Run 'show ip interface brief' and 'show vlan brief' commands on switches
        ios_command:
          commands:
            - show ip interface brief
            - show vlan brief
        register: interface_output_sw
        when: "'selectedgroupswitch' in group_names"

      - name: Display 'show ip interface brief' and 'show vlan brief' Command Details on switches
        debug:
          msg: "{{{{ interface_output_sw.stdout_lines }}}}"
        when: "'selectedgroupswitch' in group_names"

      - name: Run 'show ip interface brief' command on routers
        ios_command:
          commands:
            - show ip interface brief
        register: interface_output_rt
        when: "'selectedgrouprouter' in group_names"

      - name: Display 'show ip interface brief' Command Details on routers
        debug:
          msg: "{{{{ interface_output_rt.stdout_lines }}}}"
        when: "'selectedgrouprouter' in group_names"
"""
    
    return playbook_content
