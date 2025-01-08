def sh_ip_int_br():
    playbook_content = """
---
  - name: Show IP Interface Brief
    hosts: all
    gather_facts: no
    tasks:
      - name: Run 'show ip interface brief' command
        ios_command:
          commands:
          - show ip interface brief
          - show vlan brief
        register: interface_output
      - name: Filter interface details
        debug:
          msg: "{{ interface_output.stdout_lines }}"
  """

    return playbook_content
