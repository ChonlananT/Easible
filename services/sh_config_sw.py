def sh_config(device_type: str):
    if device_type == "switch":
        hosts_line = "selectedgroupswitch"
        commands = [
            "show ip interface brief",
            "show vlan brief",
            "show spanning-tree"
        ]
    elif device_type == "router":
        hosts_line = "selectedgrouprouter"
        commands = [
            "show ip interface brief"
        ]
    else:
        hosts_line = "selectedgroup"  # ค่าเริ่มต้นหรือกรณีอื่นๆ
        commands = [
            "show ip interface brief",
            "show vlan brief",
            "show spanning-tree"
        ]

    # สร้างเนื้อหา Playbook โดยใช้ hosts_line และ commands ที่ได้
    playbook_content = f"""
---
  - name: Show IP Interface Brief on Devices
    hosts: {hosts_line}
    gather_facts: no
    tasks:
      - name: Run commands on devices
        ios_command:
          commands:
{chr(10).join([f"            - {cmd}" for cmd in commands])}
        register: interface_output

      - name: Display interface details
        debug:
          msg: "{{{{ interface_output.stdout_lines }}}}"
    """
    return playbook_content
