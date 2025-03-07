def sh_router_switch(data):
    """
    Generate an Ansible playbook string to verify interface configurations.
    
    The function expects a dictionary (data) with keys:
      - switchHost: hostname for the switch (e.g. "SW101")
      - routerHost: hostname for the router (e.g. "R102")
      - switchInterface: interface on the switch (e.g. "GigabitEthernet1/0/15")
      - routerInterface: base interface on the router (e.g. "GigabitEthernet0/1")
      - vlanConfigs: (optional) list of dicts each with:
            - vlanId (e.g. "201")
            - gateway (not used in command but available if needed)
            - subnet  (not used in command but available if needed)
            
    It returns a string representing the playbook content.
    """
    switch_host = data.get("switchHost")
    router_host = data.get("routerHost")
    switch_iface = data.get("switchInterface")
    router_iface = data.get("routerInterface")
    vlan_configs = data.get("vlanConfigs", [])

    # Utility function to sanitize identifiers (remove characters like '/' and '.')
    def sanitize(text):
        return text.replace('/', '_').replace('.', '_')

    playbook_lines = [
        "---",
        "- name: Verify interface configuration",
        "  hosts: all",
        "  gather_facts: no",
        "  tasks:",
    ]

    # Build tasks for the switch host if provided.
    if switch_host and switch_iface:
        switch_reg = f"output_{sanitize(switch_host)}_{sanitize(switch_iface)}"
        playbook_lines.extend([
            f"    - name: Run commands on {switch_host} for interface {switch_iface}",
            "      ios_command:",
            "        commands:",
            f"          - show run int {switch_iface}",
            f"      register: {switch_reg}",
            f"      when: inventory_hostname == \"{switch_host}\"",
            "",
            f"    - name: Debug output for {switch_host} interface {switch_iface}",
            "      debug:",
            f"        msg: \"{{{{ {switch_reg}.stdout_lines }}}}\"",
            f"      when: inventory_hostname == \"{switch_host}\"",
            ""
        ])

    # Build tasks for the router host.
    if router_host:
        # If vlanConfigs are provided, create a task per VLAN.
        if vlan_configs:
            for vlan in vlan_configs:
                vlan_id = vlan.get("vlanId")
                if not vlan_id:
                    continue  # Skip if no vlanId provided
                # Append vlan id to the router interface (e.g. GigabitEthernet0/1.201)
                full_router_iface = f"{router_iface}.{vlan_id}"
                router_reg = f"output_{sanitize(router_host)}_{sanitize(router_iface)}_{sanitize(vlan_id)}"
                playbook_lines.extend([
                    f"    - name: Run commands on {router_host} for interface {full_router_iface}",
                    "      ios_command:",
                    "        commands:",
                    f"          - show run int {full_router_iface}",
                    f"      register: {router_reg}",
                    f"      when: inventory_hostname == \"{router_host}\"",
                    "",
                    f"    - name: Debug output for {router_host} interface {full_router_iface}",
                    "      debug:",
                    f"        msg: \"{{{{ {router_reg}.stdout_lines }}}}\"",
                    f"      when: inventory_hostname == \"{router_host}\"",
                    ""
                ])
        # Otherwise, create a single task using the provided router interface.
        elif router_iface:
            router_reg = f"output_{sanitize(router_host)}_{sanitize(router_iface)}"
            playbook_lines.extend([
                f"    - name: Run commands on {router_host} for interface {router_iface}",
                "      ios_command:",
                "        commands:",
                f"          - show run int {router_iface}",
                f"      register: {router_reg}",
                f"      when: inventory_hostname == \"{router_host}\"",
                "",
                f"    - name: Display output for {router_host} interface {router_iface}",
                "      debug:",
                f"        msg: \"{{{{ {router_reg}.stdout_lines }}}}\"",
                f"      when: inventory_hostname == \"{router_host}\"",
                ""
            ])

    # Join the lines into a final playbook content string.
    playbook_content = "\n".join(playbook_lines)
    return playbook_content
