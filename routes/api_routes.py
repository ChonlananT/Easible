import re
import ipaddress
from flask import Blueprint, request, jsonify
from services.ssh_service import create_ssh_connection
from services.parse import parse_result, parse_interface, parse_switchport
from services.ansible_playbook import generate_playbook
from services.database import add_device, fetch_all_devices, delete_device
from services.generate_inventory import generate_inventory_content
from services.sh_ip_int_br import sh_ip_int_br

api_bp = Blueprint('api', __name__)

@api_bp.route('/api/get_hosts', methods=['GET'])
def get_hosts():
    try:
        devices = fetch_all_devices()
        return jsonify(devices), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route('/api/delete_host', methods=['DELETE'])
def delete_host():
    try:
        data = request.json
        hostname = data['hostname']
        delete_device(hostname)
        return jsonify({"message": f"Device '{hostname}' deleted successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route('/api/add_host', methods=['POST'])
def add_host():
    try:
        data = request.json
        add_device(
            data['deviceType'],
            data['hostname'],
            data['ipAddress'],
            data['username'],
            data['password'],
            data['enablePassword']
        )
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_inventory', methods=['POST'])
def create_inventory():
    try:
        # Generate inventory content
        inventory_content = generate_inventory_content()

        # Create SSH connection and get the username
        ssh, username = create_ssh_connection()
        if not ssh or not username:
            raise Exception("Failed to create SSH connection or retrieve username.")

        # Define the path using the returned username
        inventory_path = f"/home/{username}/inventory/inventory.ini"

        # Write inventory content to the remote file
        sftp = ssh.open_sftp()
        with sftp.open(inventory_path, 'w') as inventory_file:
            inventory_file.write(inventory_content)
        sftp.close()
        ssh.close()

        return jsonify({"message": "Inventory created successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/show_detail', methods=['POST'])
def show_interface_brief():
    try:
        # Generate playbook content
        playbook_content = sh_ip_int_br()

        # Create SSH connection to the VM
        ssh, username = create_ssh_connection()

        # Define paths for inventory and playbook inside the VM
        inventory_path = f"/home/{username}/inventory/inventory.ini"
        playbook_path = f"/home/{username}/playbook/interface.yml"

        # Write the playbook content to a file on the VM
        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Define the ansible command to run on the VM
        ansible_command = f"ansible-playbook -i {inventory_path} {playbook_path}"

        # Execute the command on the VM
        stdout, stderr = ssh.exec_command(ansible_command)[1:]
        output = stdout.read().decode("utf-8")
        error = stderr.read().decode("utf-8")

        # Parse the interface data
        parsed_result = parse_interface(output)
        ssh.close()

        # Return the structured data
        return jsonify({"parsed_result": parsed_result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_playbook', methods=['POST'])
def create_playbook():
    try:
        # Receive data from the frontend
        data = request.json
        hostname1 = data.get("hostname1")  # Get host from frontend
        hostname2 = data.get("hostname2")  # Get host from frontend
        command = data.get("command")  # Command selected for host
        vlan_data = data.get("vlanData", {})  # VLAN data if command is vlan
        switchport_mode = data.get("switchportMode")  # Switchport mode if command is switchport
        interface1 = data.get("interface1")  # Interface selected for host1
        interface2 = data.get("interface2")  # Interface selected for host2
        
        # Validate required fields
        if not hostname1 or not command:
            return jsonify({"error": "Missing hostname1 or command"}), 400

        if not hostname2:
            return jsonify({"error": "Missing hostname2"}), 400
        
        # Define playbook content based on the command type
        if command == "vlan":
            vlan_id1 = vlan_data.get("vlanId1")
            vlan_name1 = vlan_data.get("vlanName1")
            vlan_id2 = vlan_data.get("vlanId2")
            vlan_name2 = vlan_data.get("vlanName2")
            ip_address1 = vlan_data.get("ipAddress1")
            ip_address2 = vlan_data.get("ipAddress2")
            subnet_mask1 = vlan_data.get("subnetMask1")
            subnet_mask2 = vlan_data.get("subnetMask2")
            interface1_vlan = vlan_data.get("interface1")
            interface2_vlan = vlan_data.get("interface2")

            # Validate that at least one VLAN configuration is provided
            if not ((vlan_id1 and vlan_name1) or (vlan_id2 and vlan_name2)):
                return jsonify({"error": "Provide VLAN ID and Name for at least one host"}), 400

            # Calculate subnet if subnet_mask is provided
            def calculate_subnet(ip, subnet_mask):
                try:
                    network = ipaddress.IPv4Network(f"{ip}/{subnet_mask}", strict=False)
                    return network.network_address, network.netmask
                except ValueError as e:
                    return None, str(e)

            subnet1, netmask1 = calculate_subnet(ip_address1, subnet_mask1) if ip_address1 and subnet_mask1 else (None, None)
            subnet2, netmask2 = calculate_subnet(ip_address2, subnet_mask2) if ip_address2 and subnet_mask2 else (None, None)
            
            playbook_content_checker = f"""
---
- name: check VLAN on specific hosts
  hosts: {hostname1},{hostname2}
  gather_facts: no
  tasks:
"""
            if interface1_vlan:
                playbook_content_checker += f"""
      - name: Run 'show run int {interface1_vlan}' command on {hostname1}
        ios_command:
          commands:
          - show run interface {interface1_vlan}
        when: inventory_hostname == "{hostname1}"
        register: interface1_output
      - name: Filter interface details on {hostname1}
        debug:        
"""
                playbook_content_checker += """          msg: "{{ interface1_output.stdout_lines }}"
"""
                playbook_content_checker += f"""
        when: interface1_output is defined and inventory_hostname == "{hostname1}"
"""
            if interface2_vlan:
                playbook_content_checker +=f"""      - name: Run 'show run int {interface2_vlan}' command on {hostname2}
        ios_command:
          commands:
          - show run interface {interface2_vlan}
        when: inventory_hostname == "{hostname2}"
        register: interface2_output
      - name: Filter interface details on {hostname2}
        debug:
"""
                playbook_content_checker += """
          msg: "{{ interface2_output.stdout_lines }}"
"""
                playbook_content_checker += f"""
        when: interface2_output is defined and inventory_hostname == "{hostname2}"
"""
            ssh, username = create_ssh_connection()
            inventory_path = f"/home/{username}/inventory/inventory.ini"
            playbook_checker_path = f"/home/{username}/playbook/vlanchecker.yml"
            sftp = ssh.open_sftp()
            with sftp.open(playbook_checker_path, "w") as playbook_file:
                playbook_file.write(playbook_content_checker)
            sftp.close()
            ansible_command = f"ansible-playbook -i {inventory_path} {playbook_checker_path}"
            stdout, stderr = ssh.exec_command(ansible_command)[1:]
            output = stdout.read().decode("utf-8")
            error = stderr.read().decode("utf-8")
            parse_result = parse_switchport(output)
            ssh.close()
            print(parse_result)
            playbook_content = f"""
---
- name: Configure VLAN on specific hosts
  hosts: {hostname1},{hostname2}
  gather_facts: no
  tasks:
"""
            for result in parse_result:
              hostname = result['hostname']
              switchport = result['switchport']
              interface = result['interface']

              if vlan_id1 and vlan_name1 and hostname == hostname1:
                  playbook_content += f"""
    - name: Configure VLAN for {hostname}
      ios_config:
        lines:
          - vlan {vlan_id1}
          - name {vlan_name1}
"""
                  if ip_address1 and netmask1:
                      playbook_content += f"""          - int vlan {vlan_id1}
          - ip address {ip_address1} {netmask1}
"""
        
                  if switchport == "access":
                      playbook_content += f"""          - int {interface1_vlan}
          - switchport mode trunk
          - switchport trunk allowed vlan {vlan_id1}
"""
                  elif switchport == "trunk":
                      playbook_content += f"""          - int {interface1_vlan}
          - switchport mode trunk
          - switchport trunk allowed vlan add {vlan_id1}
"""
                  playbook_content += f"""      when: inventory_hostname == "{hostname1}"
"""

              # Add configuration for SW2 if provided
              if vlan_id2 and vlan_name2 and hostname == hostname2:
                  playbook_content += f"""
    - name: Configure VLAN for {hostname}
      ios_config:
        lines:
          - vlan {vlan_id2}
          - name {vlan_name2}
"""
                  if ip_address2 and netmask2:
                      playbook_content += f"""          - int vlan {vlan_id2}
          - ip address {ip_address2} {netmask2}
"""
        
                  if switchport == "access":
                      playbook_content += f"""          - int {interface2_vlan}
          - switchport mode trunk
          - switchport trunk allowed vlan {vlan_id2}
"""
                  elif switchport == "trunk":
                      playbook_content += f"""          - int {interface2_vlan}
          - switchport mode trunk
          - switchport trunk allowed vlan add {vlan_id2}
"""
                  playbook_content += f"""      when: inventory_hostname == "{hostname2}"
"""
              
        elif command == "switchport":
            if not switchport_mode or not interface1 or not interface2:
                return jsonify({"error": "Switchport mode, interface1, and interface2 are required for switchport command"}), 400
            
            playbook_content = f"""
---
- name: Configure Switchport on specific hosts
  hosts: {hostname1},{hostname2}
  gather_facts: no
  tasks:
    - name: Configure Switchport for {hostname1}
      ios_config:
        lines:"""
            if switchport_mode == 'access':
              playbook_content += f"""
          - no switchport trunk allowed vlan
          - switchport mode access"""
            else:
              playbook_content += f"""
          - switchport mode trunk"""
            playbook_content += f"""
        parents: interface {interface1}
      when: inventory_hostname == "{hostname1}"

    - name: Configure Switchport for {hostname2}
      ios_config:
        lines:"""
            if switchport_mode == 'access':
              playbook_content += f"""
          - no switchport trunk allowed vlan
          - switchport mode access"""
            else:
              playbook_content += f"""
          - switchport mode trunk"""
            playbook_content += f"""
        parents: interface {interface2}
      when: inventory_hostname == "{hostname2}"
"""     
        elif command == "bridge_priority":
          vlan = data.get("bridgePriority", {}).get("vlan")
          priority1 = data.get("bridgePriority", {}).get("priority1")
          priority2 = data.get("bridgePriority", {}).get("priority2")

          if not vlan or not priority1 or not priority2:
              return jsonify({"error": "VLAN and priorities for both switches are required"}), 400

          playbook_content = f"""
---
- name: Configure Bridge Priority
  hosts: {hostname1},{hostname2}
  gather_facts: no
  tasks:
    - name: Set Bridge Priority for {hostname1}
      ios_config:
        lines:
          - spanning-tree vlan {vlan} priority {priority1}
      when: inventory_hostname == "{hostname1}"

    - name: Set Bridge Priority for {hostname2}
      ios_config:
        lines:
          - spanning-tree vlan {vlan} priority {priority2}
      when: inventory_hostname == "{hostname2}"
"""


        else:
            return jsonify({"error": "Unsupported command"}), 400

        # Create SSH connection and write the playbook to file on the server
        ssh, username = create_ssh_connection()
        playbook_path = f"/home/{username}/playbook/playbook.yml"
        inventory_path = f"/home/{username}/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()
        ssh.close()

        # Respond to frontend that the playbook was created successfully
        return jsonify({"message": "Playbook created successfully", "playbook": playbook_content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
