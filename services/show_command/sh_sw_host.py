def sh_sw_host(data):
    """
    Generates an Ansible playbook to verify interface configurations.

    Expects data as a list of dictionaries with the following structure:

      [
        {
          "hostname": "host1",
          "interfaces": [
            {
              "interface": "GigabitEthernet0/1",
              "vlanId": 10,
              "ipAddress": "192.168.1.1",
              "subnetMask": "255.255.255.0"
            },
            ...
          ]
        },
        ...
      ]

    For each interface under each host, the generated playbook will contain:
      1. A task that executes two commands using ios_command:
         - "sh run int vlan {vlanId}"
         - "show run int {interface}"
      2. A task that debugs the output using the debug module.
    
    Both tasks include a when condition so that they only run on the specified host.
    """
    playbook_lines = [
        "---",
        "- name: Verify interface configuration",
        "  hosts: all",
        "  gather_facts: no",
        "  tasks:",
    ]

    # Iterate over each host entry in the data list
    for entry in data:
        hostname = entry.get("hostname")
        interfaces = entry.get("interfaces", [])
        for iface in interfaces:
            interface = iface.get("interface")
            vlanId = iface.get("vlanId")
            safe_iface = interface.replace('/', '_')

            # Task to execute both commands using ios_command.
            task_command = f"""    - name: Run commands on {hostname} for interface {interface}
      ios_command:
        commands:
          - "show run int {interface}"
          - "sh run int vlan {vlanId}"
      register: output_{hostname}_{safe_iface}
      when: inventory_hostname == "{hostname}" """
            playbook_lines.append(task_command)

            # Task to debug the output of the commands.
            task_debug = f"""    - name: Display output for {hostname} interface of {interface} and VLAN {vlanId}
      debug:
        msg: "{{{{ output_{hostname}_{safe_iface}.stdout_lines }}}}"
      when: inventory_hostname == "{hostname}" """
            playbook_lines.append(task_debug)

    # Return the playbook content as a YAML-formatted string
    return "\n".join(playbook_lines)