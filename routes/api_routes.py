import re
from flask import Blueprint, request, jsonify
from services.ssh_service import create_ssh_connection
from services.parse import parse_result, parse_interface
from services.ansible_playbook import generate_playbook
from services.database import add_device, fetch_all_devices, delete_device
# from services.database.delete_db_host import delete_device
# from services.database.get_db_host import fetch_all_devices
from services.generate_inventory import generate_inventory_content
from services.sh_ip_int_br import sh_ip_int_br
# from services.parse_interface import parse_interface

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

# @api_bp.route('/api/create_playbook', methods=['POST'])
# def create_playbook():
#     try:
#         data = request.json
#         host = data['host']
#         port = int(data['port'])
#         username = data['username']
#         password = data['password']
#         commands = data['commands']
#         interface_commands = data['interfaceCommands']  # Get interface commands

#         playbook_content = f"""---
# - name: Generated Ansible Playbook
#   hosts: all
#   gather_facts: no
#   tasks:
# """
#         # Add regular commands
#         for cmd in commands:
#             playbook_content += f"""
#     - name: Run "{cmd}"
#       ios_command:
#         commands: [{cmd}]
#       register: result_{cmd.replace(" ", "_")}

#     - name: Show "{cmd}" result
#       debug:
#         var: result_{cmd.replace(" ", "_")}.stdout_lines
# """

#        # Add interface configuration if commands are provided
#         if interface_commands:
#             playbook_content += "\n    - name: Configure interfaces\n"
#             playbook_content += """      ios_config:
#         lines:"""
#             for iface_cmd in interface_commands:
#                 playbook_content += f"""
#          - {iface_cmd}"""

#         ssh = create_ssh_connection(host, port, username, password)
#         playbook_path = f"/home/{username}/playbook/playbook.yml"
#         sftp = ssh.open_sftp()
#         with sftp.open(playbook_path, 'w') as playbook_file:
#             playbook_file.write(playbook_content)
#         sftp.close()
#         ssh.close()

#         return jsonify({"message": "Playbook created successfully."})
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500
    
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

@api_bp.route('/api/show_ip_interface_brief', methods=['POST'])
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
            vlan_id = vlan_data.get("vlanId")
            vlan_name = vlan_data.get("vlanName")
            ip_address1 = vlan_data.get("ipAddress1")
            ip_address2 = vlan_data.get("ipAddress2")

            if not vlan_id or not vlan_name:
                return jsonify({"error": "VLAN ID and VLAN Name are required for the vlan command"}), 400

            playbook_content = f"""
---
- name: Configure VLAN on {hostname1} and {hostname2}
  hosts: {hostname1},{hostname2}
  gather_facts: no
  tasks:
    - name: Configure VLAN for {hostname1}
      ios_config:
        lines:
          - vlan {vlan_id}
          - name {vlan_name}
          - ip address {ip_address1}  # Optional, based on the input
      when: inventory_hostname == "{hostname1}"

    - name: Configure VLAN for {hostname2}
      ios_config:
        lines:
          - vlan {vlan_id}
          - name {vlan_name}
          - ip address {ip_address2}  # Optional, based on the input
      when: inventory_hostname == "{hostname2}"
"""

        elif command == "switchport":
            if not switchport_mode or not interface1 or not interface2:
                return jsonify({"error": "Switchport mode, interface1, and interface2 are required for switchport command"}), 400
            
            playbook_content = f"""
---
- name: Configure Switchport on {hostname1} and {hostname2}
  hosts: {hostname1},{hostname2}
  gather_facts: no
  tasks:
    - name: Configure Switchport for {hostname1}
      ios_config:
        lines:
          - switchport mode {switchport_mode}
        parents: interface {interface1}
      when: inventory_hostname == "{hostname1}"

    - name: Configure Switchport for {hostname2}
      ios_config:
        lines:
          - switchport mode {switchport_mode}
        parents: interface {interface2}
      when: inventory_hostname == "{hostname2}"
"""

        else:
            return jsonify({"error": "Unsupported command"}), 400

        # Create SSH connection and write the playbook to file on the server
        ssh, username = create_ssh_connection()
        playbook_path = f"/home/{username}/playbook/playbook.yml"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()
        ssh.close()

        # Respond to frontend that the playbook was created successfully
        return jsonify({"message": "Playbook created successfully", "playbook": playbook_content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
