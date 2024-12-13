from flask import Blueprint, request, jsonify
from services.ssh_service import create_ssh_connection
from services.parse_service import parse_result
from services.ansible_playbook import generate_playbook
from services.add_db_host import add_device
from services.delete_db_host import delete_device
from services.get_db_host import fetch_all_devices

api_bp = Blueprint('api', __name__)

@api_bp.route('/api/show_interface_brief', methods=['POST'])
def show_interface_brief():
    try:
        data = request.json
        host = data['host']
        port = int(data['port'])
        username = data['username']
        password = data['password']

        ssh = create_ssh_connection(host, port, username, password)
        ssh.close()

        return jsonify({"message": "sh int br successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_playbook', methods=['POST'])
def create_playbook():
    try:
        data = request.json
        host = data['host']
        port = int(data['port'])
        username = data['username']
        password = data['password']
        commands = data['commands']
        interface_commands = data['interfaceCommands']  # Get interface commands

        playbook_content = f"""---
- name: Generated Ansible Playbook
  hosts: all
  gather_facts: no
  tasks:
"""
        # Add regular commands
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

       # Add interface configuration if commands are provided
        if interface_commands:
            playbook_content += "\n    - name: Configure interfaces\n"
            playbook_content += """      ios_config:
        lines:"""
            for iface_cmd in interface_commands:
                playbook_content += f"""
         - {iface_cmd}"""

        ssh = create_ssh_connection(host, port, username, password)
        playbook_path = f"/home/{username}/playbook/playbook.yml"
        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, 'w') as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()
        ssh.close()

        return jsonify({"message": "Playbook created successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_inventory', methods=['POST'])
def create_inventory():
    try:
        data = request.json
        host = data['host']
        port = int(data['port'])
        username = data['username']
        password = data['password']
        inventory_content = data['inventoryContent']

        ssh = create_ssh_connection(host, port, username, password)
        inventory_path = f"/home/{username}/inventory/inventory.ini"
        sftp = ssh.open_sftp()
        with sftp.open(inventory_path, 'w') as inventory_file:
            inventory_file.write(inventory_content)
        sftp.close()
        ssh.close()

        return jsonify({"message": "Inventory created successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/run_playbook', methods=['POST'])
def run_playbook():
    try:
        # Get data from the incoming request
        data = request.json
        host = data['host']
        port = int(data['port'])
        username = data['username']
        password = data['password']

        # SSH connection setup (use your function to establish the connection)
        ssh = create_ssh_connection(host, port, username, password)
        ansible_command = f"ansible-playbook -i /home/{username}/inventory/inventory.ini /home/{username}/playbook/playbook.yml"
        
        # Execute the command
        stdin, stdout, stderr = ssh.exec_command(ansible_command)
        output = stdout.read().decode()
        error = stderr.read().decode()
        ssh.close()

        # Parse the result to extract values inside square brackets
        parsed_result = parse_result({"stdout_lines": [[output]]})
        
        if error:
            return jsonify({"error": error}), 500

        # Return the parsed result along with the standard output
        return jsonify({
            "output": output,
            "parsed_result": parsed_result
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
