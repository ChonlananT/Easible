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
        # รับข้อมูลจาก frontend
        data = request.json
        hostname = data.get("hostname")  # กำหนด host จาก frontend
        interface = data.get("interface")  # Interface ที่เลือก
        command = data.get("command")  # Command ที่เลือก

        if not hostname or not command:
            return jsonify({"error": "Missing hostname or command"}), 400

        # ตรวจสอบว่า Command ต้องเข้า Config Mode หรือไม่
        is_config_mode = command.startswith("conf t") or "interface" in command

        # สร้างเนื้อหา Playbook
        playbook_content = f"""
---
- name: Execute Network Command
  hosts: {hostname}
  gather_facts: no
  tasks:
    - name: Enter Configuration Mode and Execute Commands
      ios_config:
        lines:
          - {command.replace("\\n", "\\n                  - ")}
        parents: interface {interface}
"""

        # สร้างไฟล์ Playbook บน VM
        ssh, username = create_ssh_connection()
        playbook_path = f"/home/{username}/playbook/playbook.yml"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()
        ssh.close()

        # ตอบกลับ frontend ว่า Playbook ถูกสร้างสำเร็จ
        return jsonify({"message": "Playbook created successfully", "playbook": playbook_content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
