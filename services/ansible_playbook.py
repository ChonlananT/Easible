def generate_playbook(commands, interface_commands=None):
    playbook_content = f"""---
- name: Generated Ansible Playbook
  hosts: all
  gather_facts: no
  tasks:
"""
    for cmd in commands:
        playbook_content += f"""
    - name: Run "{cmd}"
      ios_command:
        commands: [{cmd}]
      register: result_{cmd.replace(" ", "_")}

    - name: Show "{cmd}" result
      debug:
        var: result_{cmd.replace(" ", "_")}.stdout_lines
"""
    if interface_commands:
        playbook_content += "\n    - name: Configure interfaces\n"
        playbook_content += """      ios_config:
        lines:"""
        for iface_cmd in interface_commands:
            playbook_content += f"""
         - {iface_cmd}"""
    return playbook_content
