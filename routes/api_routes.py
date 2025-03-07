import re
import json
import ipaddress
import time
from flask import Blueprint, request, jsonify
from services.ssh_service import create_ssh_connection
from services.parse import parse_ansible_output, parse_result, parse_interface, parse_configd, parse_dashboard, parse_sh_int_trunk, parse_routes, parse_switch_host, parse_router_switch, parse_config_device, parse_verify_output
from services.database import add_device, fetch_all_devices, delete_device, assign_group_to_hosts, delete_group, create_custom_lab_in_db, fetch_all_custom_labs, delete_custom_lab_in_db, update_custom_lab_in_db
from services.generate_inventory import generate_inventory_content
from services.show_command import sh_ip_int_br, sh_ip_int_br_rt, sh_dashboard, sh_swtort, sh_int_trunk, sh_ip_route, sh_sw_host, sh_router_switch, sh_config_device
from services.show_command.sh_config_sw import sh_config
from services.calculate_network_id import calculate_network_id
from services.routing_service import RoutingService
from services.compare import compare_expected_outputs
from services.compare_swhost import compare_switch_host
from services.stp_calculating_services import recalc_stp
from services.compare_router_switch import compare_router_switch
from services.compare_config_device import compare_config_device
from services.compare_routing_table import compare_routing_tables


api_bp = Blueprint('api', __name__)

@api_bp.route('/api/get_hosts', methods=['GET'])
def get_hosts():
    try:
        devices = fetch_all_devices()
        return jsonify(devices), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/add_group', methods=['POST'])
def add_group():
    """
    ตัวอย่าง JSON ที่ส่งมา:
    {
        "group_name": "Routers",
        "hostnames": ["R101", "R102"]
    }
    """
    data = request.json
    group_name = data.get('group_name')
    hostnames = data.get('hostnames', [])

    if not group_name or not isinstance(hostnames, list):
        return jsonify({"error": "Invalid data"}), 400

    success = assign_group_to_hosts(group_name, hostnames)
    if success:
        return jsonify({"message": "Group assigned successfully."}), 200
    else:
        return jsonify({"error": "Error assigning group."}), 500
    
@api_bp.route('/api/delete_group', methods=['DELETE'])
def api_delete_group():
    """
    ตัวอย่าง JSON ที่ส่งมา:
    {
        "group_name": "Routers"
    }
    """
    data = request.json
    group_name = data.get('group_name')

    if not group_name:
        return jsonify({"error": "Group name is required."}), 400

    success, message = delete_group(group_name)
    if success:
        return jsonify({"message": message}), 200
    else:
        return jsonify({"error": message}), 400

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
            data['enablePassword'],
        )
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/dashboard', methods=['POST'])
def dashboard():
    try:
        # Generate playbook content based on selected groups
        playbook_content = sh_dashboard()

        # Create SSH connection to the VM
        ssh, username = create_ssh_connection()

        # Define paths for inventory and playbook inside the VM
        inventory_path = f"/app/inventory/inventory.ini"
        playbook_path = f"/app/playbook/dashboard.yml"

        # Write the playbook content to a file on the VM
        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Define the ansible command to run on the VM
        ansible_command = f"ansible-playbook -i {inventory_path} {playbook_path}"

        # Execute the command on the VM
        stdin, stdout, stderr = ssh.exec_command(ansible_command)
        output = stdout.read().decode("utf-8")
        error = stderr.read().decode("utf-8")

        # Parse the interface data
        parsed_result = parse_dashboard(output)  # สมมติว่ามีฟังก์ชัน parse_dashboard

        # Close the SSH connection
        ssh.close()

        # Fetch all devices from the database
        devices = fetch_all_devices()  # Assumes this returns a list of dicts
        # Create a mapping from hostname to deviceType
        device_mapping = {}
        for device in devices:
            hostname = device.get("hostname")
            device_type = device.get("deviceType")
            if hostname:
                device_mapping[hostname] = device_type

        # Update the parsed_result to include deviceType for hostnames found in the database
        for key in ["ok", "fatal"]:
            updated_list = []
            for hostname in parsed_result.get(key, []):
                updated_list.append({
                    "hostname": hostname,
                    "deviceType": device_mapping.get(hostname)  # Will be None if not found
                })
            parsed_result[key] = updated_list

        # Return the structured data with device type information
        return jsonify({"parsed_result": parsed_result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_inventory', methods=['POST'])
def create_inventory():
    try:
        data = request.json
        selected_groups = data.get('groups', [])

        if not selected_groups:
            return jsonify({"error": "No groups selected for inventory creation."}), 400

        # Generate inventory content based on selected groups
        inventory_content = generate_inventory_content(selected_groups)

        # Create SSH connection and get the username
        ssh, username = create_ssh_connection()
        if not ssh or not username:
            raise Exception("Failed to create SSH connection or retrieve username.")

        # Define the path using the returned username
        inventory_path = f"/app/inventory/inventory.ini"

        # Write inventory content to the remote file
        sftp = ssh.open_sftp()
        with sftp.open(inventory_path, 'w') as inventory_file:
            inventory_file.write(inventory_content)
        sftp.close()
        ssh.close()

        return jsonify({"message": "Inventory created successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/show_detail_switch', methods=['POST'])
def show_interface_brief():
    try:
        # Generate playbook content based on selected groups
        playbook_content = sh_ip_int_br()

        # Create SSH connection to the VM
        ssh, username = create_ssh_connection()

        # Define paths for inventory and playbook inside the VM
        inventory_path = f"/app/inventory/inventory.ini"
        playbook_path = f"/app/playbook/interface.yml"

        # Write the playbook content to a file on the VM
        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Define the ansible command to run on the VM
        ansible_command = f"ansible-playbook -i {inventory_path} {playbook_path}"

        # Execute the command on the VM
        stdin, stdout, stderr = ssh.exec_command(ansible_command)
        output = stdout.read().decode("utf-8")
        error = stderr.read().decode("utf-8")

        # Parse the interface data
        parsed_result = parse_interface(output)  # สมมติว่ามีฟังก์ชัน parse_interface

        # ปิดการเชื่อมต่อ SSH
        ssh.close()

        # Return the structured data
        return jsonify({"parsed_result": parsed_result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/show_detail_router', methods=['POST'])
def show_interface_brief_router():
    try:
        # Generate playbook content
        playbook_content = sh_ip_int_br_rt()

        # Create SSH connection to the VM
        ssh, username = create_ssh_connection()

        # Define paths for inventory and playbook inside the VM
        inventory_path = f"/app/inventory/inventory.ini"
        playbook_path = f"/app/playbook/interface.yml"

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

@api_bp.route('/api/show_detail_swtort', methods=['POST'])
def show_swtort():
    try:
        # Generate playbook content based on selected groups
        playbook_content = sh_swtort()

        # Create SSH connection to the VM
        ssh, username = create_ssh_connection()

        # Define paths for inventory and playbook inside the VM
        inventory_path = f"/app/inventory/inventory.ini"
        playbook_path = f"/app/playbook/interface.yml"

        # Write the playbook content to a file on the VM
        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Define the ansible command to run on the VM
        ansible_command = f"ansible-playbook -i {inventory_path} {playbook_path}"

        # Execute the command on the VM
        stdin, stdout, stderr = ssh.exec_command(ansible_command)
        output = stdout.read().decode("utf-8")
        error = stderr.read().decode("utf-8")

        # Parse the interface data (assumes a function parse_interface exists)
        parsed_result = parse_interface(output)

        # Retrieve all devices info
        devices = fetch_all_devices()  # This should return a list of dicts with keys: 
                                        # "id", "deviceType", "hostname", "ipAddress", 
                                        # "username", "password", "enablePassword", "groups"
        # Build a lookup dictionary keyed by hostname for faster matching
        devices_map = {device['hostname']: device for device in devices}

        # Add deviceType information to each host in the parsed result
        for host in parsed_result:
            hostname = host.get('hostname')
            if hostname in devices_map:
                host['deviceType'] = devices_map[hostname]['deviceType']
            else:
                # If no match is found, set a default (or leave it out)
                host['deviceType'] = ''

        # Close SSH connection
        ssh.close()

        # Return the structured data including deviceType for each host
        return jsonify({"parsed_result": parsed_result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_playbook_swtosw', methods=['POST'])
def create_playbook():
    try:
        # 1) Retrieve data from the request
        data = request.json

        # Accept either a single link (dict) or multiple links (list)
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of link configurations."}), 400

        # This playbook will include tasks for all links
        trunked_interfaces = set()  # to track if an interface has already been trunked
        playbook_content = """---
- name: Configure multiple links
  hosts: selectedgroup
  gather_facts: no
  tasks:
"""

        # 2) Loop through each link configuration
        for idx, link in enumerate(data, start=1):
            hostname1 = link.get("hostname1")
            hostname2 = link.get("hostname2")
            switchport_mode = link.get("switchportMode")
            interface1 = link.get("interface1")
            interface2 = link.get("interface2")
            vlans = link.get("vlans", [])  # expects an array of VLAN IDs

            # Basic validation of required fields
            if not hostname1 or not hostname2 or not switchport_mode or not interface1 or not interface2:
                return jsonify({"error": f"Link #{idx} missing required fields"}), 400

            # Build task for hostname1
            playbook_content += f"""
  - name: "[Link#{idx}] Configure Switchport for {hostname1}"
    ios_config:
      parents: interface {interface1}
      lines:
"""
            if switchport_mode == "access":
                playbook_content += f"""        - no switchport trunk allowed vlan
        - switchport mode access
"""
            else:  # trunk mode
                playbook_content += f"""        - no switchport access vlan
        - switchport mode trunk
"""
                if vlans:
                    allowed_vlans = ",".join(vlans)
                    # If the interface was already trunked, use 'add'; otherwise, set the allowed vlan list
                    if (hostname1, interface1) in trunked_interfaces:
                        playbook_content += f"""        - switchport trunk allowed vlan add {allowed_vlans}
"""
                    else:
                        playbook_content += f"""        - switchport trunk allowed vlan {allowed_vlans}
"""
                        trunked_interfaces.add((hostname1, interface1))
            playbook_content += f"""    when: inventory_hostname == "{hostname1}"
"""

            # Build task for hostname2
            playbook_content += f"""
  - name: "[Link#{idx}] Configure Switchport for {hostname2}"
    ios_config:
      parents: interface {interface2}
      lines:
"""
            if switchport_mode == "access":
                playbook_content += f"""        - no switchport trunk allowed vlan
        - switchport mode access
"""
            else:
                playbook_content += f"""        - no switchport access vlan
        - switchport mode trunk
"""
                if vlans:
                    allowed_vlans = ",".join(vlans)
                    if (hostname2, interface2) in trunked_interfaces:
                        playbook_content += f"""        - switchport trunk allowed vlan add {allowed_vlans}
"""
                    else:
                        playbook_content += f"""        - switchport trunk allowed vlan {allowed_vlans}
"""
                        trunked_interfaces.add((hostname2, interface2))
            playbook_content += f"""    when: inventory_hostname == "{hostname2}"
"""

        # 3) Write the playbook to a file on the remote server and (optionally) run ansible-playbook
        ssh, username = create_ssh_connection()  
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Optionally, you can execute the playbook immediately:
        # stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        # output = stdout.read().decode('utf-8')
        # errors = stderr.read().decode('utf-8')
        # (handle output/errors as needed)

        ssh.close()

        return jsonify({
            "message": "Playbook created successfully",
            "playbook": playbook_content,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_playbook_rttort', methods=['POST'])
def create_playbook_routerrouter():
    try:
        data = request.json

        # Ensure data is a list of links.
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of link configurations."}), 400

        # *** PLAYBOOK CREATION PART ***
        playbook_content = """---
- name: Configure router-router links
  hosts: selectedgroup
  gather_facts: no
  tasks:
"""

        # Loop through each link to generate configuration tasks.
        for idx, link in enumerate(data, start=1):
            hostname1 = link.get("hostname1")
            hostname2 = link.get("hostname2")
            interface1 = link.get("interface1")
            interface2 = link.get("interface2")
            ip1 = link.get("ip1")
            ip2 = link.get("ip2")
            subnet = link.get("subnet")
            protocol = link.get("protocol")

            # Check for required fields.
            if not (hostname1 and hostname2 and interface1 and interface2 and ip1 and ip2 and subnet):
                return jsonify({"error": f"Link #{idx}: missing required fields"}), 400

            # Calculate the network and netmask using the ipaddress module.
            try:
                network1 = ipaddress.ip_network(f"{ip1}/{subnet}", strict=False)
                netmask1 = str(network1.netmask)
            except ValueError as e:
                return jsonify({"error": f"Link #{idx} invalid IP or CIDR: {e}"}), 400

            try:
                network2 = ipaddress.ip_network(f"{ip2}/{subnet}", strict=False)
                netmask2 = str(network2.netmask)
            except ValueError as e:
                return jsonify({"error": f"Link #{idx} invalid IP or CIDR: {e}"}), 400

            # Create playbook task for configuring IP on Host1.
            playbook_content += f"""
    - name: "[Link#{idx}] Config IP on {hostname1}"
      ios_config:
        parents: interface {interface1}
        lines:
          - ip address {ip1} {netmask1}
          - no shutdown
      when: inventory_hostname == "{hostname1}"
"""

            # Create playbook task for configuring IP on Host2.
            playbook_content += f"""
    - name: "[Link#{idx}] Config IP on {hostname2}"
      ios_config:
        parents: interface {interface2}
        lines:
          - ip address {ip2} {netmask2}
          - no shutdown
      when: inventory_hostname == "{hostname2}"
"""

            # Additional configuration based on the protocol (e.g., RIP, OSPF) if provided.
            if protocol and protocol.lower() != "none":
                if protocol.lower() == "ripv2":
                    netaddr1 = str(network1.network_address)
                    netaddr2 = str(network2.network_address)
                    playbook_content += f"""
    - name: "[Link#{idx}] Configure RIP on {hostname1}"
      ios_config:
        match: none
        parents:
            - router rip
        lines:
          - version 2
          - no auto-summary
          - network {netaddr1}
      when: inventory_hostname == "{hostname1}"
"""
                    playbook_content += f"""
    - name: "[Link#{idx}] Configure RIP on {hostname2}"
      ios_config:
        match: none
        parents:
            - router rip
        lines:
          - version 2
          - no auto-summary
          - network {netaddr2}
      when: inventory_hostname == "{hostname2}"
"""
                elif protocol.lower() == "ospf":
                    playbook_content += f"""
    - name: "[Link#{idx}] Configure OSPF on {hostname1}"
      ios_config:
        parents:
          - router ospf 1
        lines:
          - network {ip1} 0.0.0.0 area 0
      when: inventory_hostname == "{hostname1}"
"""
                    playbook_content += f"""
    - name: "[Link#{idx}] Configure OSPF on {hostname2}"
      ios_config:
        parents:
          - router ospf 1
        lines:
          - network {ip2} 0.0.0.0 area 0
      when: inventory_hostname == "{hostname2}"
"""

        # Now call the RoutingService after processing all the links.
        routing_service = RoutingService()
        try:
            # process_links performs validation as well as calculating the routing tables.
            routing_tables = routing_service.process_links(data)
        except ValueError as ve:
            return jsonify({"error": f"Validation failed: {str(ve)}"}), 400
        
        ssh, username = create_ssh_connection()  
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Optionally, you can execute the playbook immediately:
        # stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        # output = stdout.read().decode('utf-8')
        # errors = stderr.read().decode('utf-8')
        # (handle output/errors as needed)

        ssh.close()

        # Return both the playbook content and the calculated routing tables back to the frontend.
        return jsonify({
            "message": "Router-Router playbook created successfully",
            "playbook": playbook_content,
            "routing_tables": routing_tables
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route('/api/create_playbook_configdevice', methods=['POST'])
def create_playbook_configdevice():
    try:
        # 1) Get the data from the request
        data = request.json

        # Allow both a single dict or a list of command configurations
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of command configurations."}), 400

        response_data = {
            "message": "Bridge Priority processed successfully",
            "stp_result": [],
        }
        # Header for the playbook
        playbook_content = """---
- name: Configure Device Commands
  hosts: selectedgroup
  gather_facts: no
  tasks:
"""

        # Use a set to track interfaces already set to trunk mode
        trunked_interfaces = set()

        stp_result = []

        # 2) Process each command configuration
        for idx, cmd in enumerate(data, start=1):
            cmd_type = cmd.get("command")  # field "command" holds the command type
            device_type = cmd.get("deviceType")
            host = cmd.get("hostname")  # host where command is to be applied

            if not cmd_type or not device_type or not host:
                return jsonify({"error": f"Missing command, deviceType, or hostname field."}), 400

            if device_type not in ["switch", "router"]:
                return jsonify({"error": f"Unsupported deviceType '{device_type}'."}), 400

            # -------------------- VLAN Command --------------------
            if cmd_type == "vlan":
                if device_type != "switch":
                    return jsonify({"error": f"VLAN command is only applicable to switches."}), 400

                # Expect multiple VLAN configurations in "vlanDataList"
                vlan_data_list = cmd.get("vlanDataList", [])
                if not vlan_data_list or not isinstance(vlan_data_list, list):
                    return jsonify({"error": f"VLAN command requires a 'vlanDataList' field."}), 400

                for v_idx, vlan_data in enumerate(vlan_data_list, start=1):
                    vlan_id = vlan_data.get("vlanId")
                    vlan_name = vlan_data.get("vlanName")
                    ip_address = vlan_data.get("ipAddress")
                    cidr = vlan_data.get("cidr")  # using 'cidr' field instead of 'subnet'
                    vlan_interfaces = vlan_data.get("interfaces", [])
                    
                    # Validate that VLAN ID and at least one interface configuration exist
                    if not vlan_id or not vlan_interfaces or not isinstance(vlan_interfaces, list):
                        return jsonify({"error": f"VLAN ID and at least one interface configuration are required."}), 400

                    # If IP address is provided, then CIDR must be provided
                    subnet_mask = ""
                    if ip_address and cidr is not None:
                        try:
                            network = ipaddress.IPv4Network(f"{ip_address}/{cidr}", strict=False)
                            subnet_mask = str(network.netmask)
                        except ValueError as e:
                            return jsonify({"error": f"Command #{idx}, VLAN config #{v_idx}: {str(e)}"}), 400

                    # Create a playbook task for VLAN configuration (common for the VLAN)
                    playbook_content += f"""
  - name: "[Command#{idx} VLAN config #{v_idx}] Configure VLAN {vlan_id} on {host}"
    ios_config:
      lines:
        - vlan {vlan_id}
"""
                    if vlan_name:
                        playbook_content += f"        - name {vlan_name}\n"
                    if ip_address and subnet_mask:
                        playbook_content += f"""        - interface vlan {vlan_id}
        - ip address {ip_address} {subnet_mask}
"""
                    playbook_content += f"""    when: inventory_hostname == "{host}"
"""

                    # Generate tasks for each physical interface configuration in this VLAN
                    for iface_idx, iface in enumerate(vlan_interfaces, start=1):
                        interface_value = iface.get("interface")
                        mode_value = iface.get("mode")
                        if mode_value == "access":
                            playbook_content += f"""
  - name: "[Command#{idx} VLAN config #{v_idx} Interface #{iface_idx}] Set Access Mode on {interface_value}"
    ios_config:
      parents: interface {interface_value}
      lines:
        - no shutdown
        - no switchport trunk allowed vlan
        - switchport mode access
        - switchport access vlan {vlan_id}
    when: inventory_hostname == "{host}"
"""
                        elif mode_value == "trunk":
                            if (host, interface_value) in trunked_interfaces:
                                playbook_content += f"""
  - name: "[Command#{idx} VLAN config #{v_idx} Interface #{iface_idx}] Add VLAN {vlan_id} to existing trunk on {interface_value}"
    ios_config:
      parents: interface {interface_value}
      lines:
        - switchport trunk allowed vlan add {vlan_id}
    when: inventory_hostname == "{host}"
"""
                            else:
                                playbook_content += f"""
  - name: "[Command#{idx} VLAN config #{v_idx} Interface #{iface_idx}] Set Trunk Mode and allow VLAN {vlan_id} on {interface_value}"
    ios_config:
      parents: interface {interface_value}
      lines:
        - no shutdown
        - no switchport access vlan
        - switchport mode trunk
        - switchport trunk allowed vlan {vlan_id}
    when: inventory_hostname == "{host}"
"""
                                trunked_interfaces.add((host, interface_value))

            # ---------------- Bridge Priority Command ----------------
            elif cmd_type == "bridge_priority":
                if device_type != "switch":
                    return jsonify({"error": f"Bridge Priority command is only applicable to switches."}), 400
                
                bridge_priority = cmd.get("bridgePriority", {})
                vlan = bridge_priority.get("vlan")
                priority = bridge_priority.get("priority")

                if vlan is None or priority is None:
                    return jsonify({"error": f"VLAN and Priority are required."}), 400
                parsed_result = cmd.get("parsed_result")
                if not parsed_result:
                    return jsonify({"error": "Missing parsed configuration data."}), 400

                stp_result = recalc_stp(parsed_result, vlan, host, priority)
                response_data["stp_result"].extend(stp_result)
                playbook_content += f"""
  - name: "[Command#{idx}] Set Bridge Priority for VLAN {vlan} on {host}"
    ios_config:
      lines:
        - spanning-tree vlan {vlan} priority {priority}
    when: inventory_hostname == "{host}"
"""
            # ---------------- Config IP Router Command ----------------
            elif cmd_type == "config_ip_router":
                config_ip = cmd.get("configIp", {})
                interface = config_ip.get("interface")
                ip_address = config_ip.get("ipAddress")
                cidr = config_ip.get("cidr")
                if not interface or not ip_address or cidr is None:
                    return jsonify({"error": f"Interface, IP Address, and CIDR are required."}), 400
                try:
                    network_id = calculate_network_id(ip_address, cidr)
                    subnet_mask = str(ipaddress.IPv4Network(f"{ip_address}/{cidr}", strict=False).netmask)
                except ValueError as e:
                    return jsonify({"error": f"Command #{idx}: {str(e)}"}), 400

                playbook_content += f"""
  - name: "[Command#{idx}] Configure IP Address on Interface {interface} on {host}"
    ios_config:
      parents: interface {interface}
      lines:
        - no shutdown
        - ip address {ip_address} {subnet_mask}
    when: inventory_hostname == "{host}"
"""
            # ---------------- Loopback Command ----------------
            elif cmd_type == "loopback":
                if device_type != "router":
                    return jsonify({"error": f"Loopback command is only applicable to routers."}), 400

                loopback_data = cmd.get("loopbackData", {})
                loopback_num = loopback_data.get("loopbackNumber")
                ip_address = loopback_data.get("ipAddress")
                if not loopback_num or not ip_address:
                    return jsonify({"error": f"Loopback Number and IP Address are required."}), 400

                # ค่า default subnet mask สำหรับ loopback
                subnet_mask = "255.255.255.255"
                try:
                    ip_obj = ipaddress.IPv4Address(ip_address)
                except ipaddress.AddressValueError:
                    return jsonify({"error": f"Invalid IP address '{ip_address}'."}), 400

                playbook_content += f"""
  - name: "[Command#{idx}] Configure Loopback {loopback_num} on {host}"
    ios_config:
      lines:
        - interface loopback {loopback_num}
        - ip address {ip_address} {subnet_mask}
    when: inventory_hostname == "{host}"
"""

                # เพิ่มการตรวจสอบ activateProtocol (none, RIPv2, OSPF)
                activate_protocol = loopback_data.get("activateProtocol", "none").lower()
                if activate_protocol != "none":
                    if activate_protocol == "ripv2":
                        playbook_content += f"""
  - name: "[Command#{idx}] Enable RIPv2 on Loopback {loopback_num} on {host}"
    ios_config:
      parents:
          - router rip
      lines:
        - version 2
        - no auto-summary
        - network {ip_address}
    when: inventory_hostname == "{host}"
"""
                    elif activate_protocol == "ospf":
                        playbook_content += f"""
  - name: "[Command#{idx}] Enable OSPF on Loopback {loopback_num} on {host}"
    ios_config:
      parents:
        - router ospf 1
      lines:
        - network {ip_address} 0.0.0.0 area 0
    when: inventory_hostname == "{host}"
"""
                    else:
                        return jsonify({"error": f"Unsupported activateProtocol value '{activate_protocol}'."}), 400

            # ---------------- Static Route Command ----------------
            elif cmd_type == "static_route":
                if device_type != "router":
                    return jsonify({"error": f"Static Route command is only applicable to routers."}), 400
                static_route = cmd.get("staticRouteData", {})
                prefix = static_route.get("prefix")
                cidr = static_route.get("cidr")
                nextHop = static_route.get("nextHop")
                if not prefix or cidr is None or not nextHop:
                    return jsonify({"error": f"Prefix, CIDR, and Next Hop are required for Static Route."}), 400
                try:
                    network_static = calculate_network_id(prefix, cidr)
                    subnet_static = str(ipaddress.IPv4Network(f"{prefix}/{cidr}", strict=False).netmask)
                except ValueError as e:
                    return jsonify({"error": f"Command #{idx} Static Route error: {e}"}), 400

                playbook_content += f"""
  - name: "[Command#{idx}] Configure Static Route on {host}"
    ios_config:
      lines:
        - ip route {network_static} {subnet_static} {nextHop}
    when: inventory_hostname == "{host}"
"""
            else:
                return jsonify({"error": f"Unsupported command type '{cmd_type}'."}), 400

        # 3) Write the combined playbook to a file on the server and optionally execute it

        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/configdevice_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Optionally, execute the playbook:
        # stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        # output = stdout.read().decode('utf-8')
        # errors = stderr.read().decode('utf-8')

        ssh.close()

        return jsonify({
            "message": "Playbook created successfully",
            "playbook": playbook_content,
            "stp_result": stp_result
            # "output": output,
            # "errors": errors
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/show_detail_configdevice', methods=['POST'])
def show_configd():
    try:
        # รับข้อมูล deviceType จาก request
        data = request.get_json()
        device_type = data.get('deviceType', '').lower()

        # Generate playbook content โดยส่ง device_type ไปที่ sh_config
        playbook_content = sh_config(device_type)

        # Create SSH connection to the VM
        ssh, username = create_ssh_connection()

        # Define paths for inventory and playbook inside the VM
        inventory_path = f"/app/inventory/inventory.ini"
        playbook_path = f"/app/playbook/configd.yml"

        # Write the playbook content to a file on the VM
        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Define the ansible command to run on the VM
        ansible_command = f"ansible-playbook -i {inventory_path} {playbook_path}"

        # Execute the command on the VM
        stdin, stdout, stderr = ssh.exec_command(ansible_command)
        output = stdout.read().decode("utf-8")
        error = stderr.read().decode("utf-8")
       

        # เลือก parse output ตามประเภทของ device
        if device_type == "switch":
            parsed_result = parse_configd(output)
        elif device_type == "router":
            parsed_result = parse_interface(output)
        else:
            parsed_result = {}  # กรณี deviceType ไม่ตรงกับที่ต้องการ

        # Close the SSH connection
        ssh.close()

        # Return the structured data
        return jsonify({"parsed_result": parsed_result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route('/api/create_playbook_swtohost', methods=['POST'])
def create_playbook_switchhost():
    try:
        # 1) Get the data from the request
        data = request.json

        # Allow both a single dict or a list of links
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of link configurations."}), 400

        # Header for the playbook
        playbook_content = """---
- name: Configure switch-to-host links
  hosts: selectedgroupswitch
  gather_facts: no
  tasks:
"""

        import ipaddress

        # 2) Process each link to generate tasks
        for idx, link in enumerate(data, start=1):
            hostname = link.get("hostname")
            interfaces = link.get("interfaces")

            if not hostname or not interfaces or not isinstance(interfaces, list):
                return jsonify({
                    "error": f"Link #{idx} is missing 'hostname' or a valid 'interfaces' array."
                }), 400

            # Process each interface configuration for the current link
            for iface_idx, iface in enumerate(interfaces, start=1):
                interface = iface.get("interface")
                vlan_id = iface.get("vlanId")
                ip_address = iface.get("ipAddress")
                subnet_mask = iface.get("subnetMask")

                # Basic validation for each interface configuration
                if not interface or not vlan_id or not ip_address or not subnet_mask:
                    return jsonify({
                        "error": f"Link #{idx} interface #{iface_idx} is missing one or more required fields."
                    }), 400

                # Calculate the netmask in dotted format using the ipaddress module
                try:
                    network = ipaddress.IPv4Network(f"{ip_address}/{subnet_mask}", strict=False)
                    netmask = str(network.netmask)
                except Exception as e:
                    return jsonify({
                        "error": f"Link #{idx} interface #{iface_idx} error calculating subnet: {str(e)}"
                    }), 400

                # Task 1: Configure the physical (GigabitEthernet) interface
                playbook_content += f"""
  - name: "[Link#{idx} Interface #{iface_idx}] Configure GigabitEthernet {interface} on {hostname}"
    ios_config:
      parents: interface {interface}
      lines:
        - no switchport mode trunk
        - no switchport trunk allowed vlan
        - switchport mode access
        - switchport access vlan {vlan_id}
        - no shutdown
    when: inventory_hostname == "{hostname}"
"""

                # Task 2: Configure the VLAN interface with IP address and netmask
                playbook_content += f"""
  - name: "[Link#{idx} Interface #{iface_idx}] Configure VLAN interface {vlan_id} on {hostname}"
    ios_config:
      parents: interface vlan {vlan_id}
      lines:
        - ip address {ip_address} {netmask}
    when: inventory_hostname == "{hostname}"
"""

        # 3) Write the generated playbook to a file on the server and (optionally) execute it
        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Optionally, you can run the playbook immediately:
        # stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        # output = stdout.read().decode('utf-8')
        # errors = stderr.read().decode('utf-8')

        ssh.close()

        return jsonify({
            "message": "Playbook created successfully",
            "playbook": playbook_content,
            # "output": output,   # Uncomment if executing the playbook
            # "errors": errors
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500  
    
@api_bp.route('/api/create_playbook_swtort', methods=['POST'])
def create_playbook_switchrouter():
    try:
        # 1) Retrieve data from the request (support both a single link and a list)
        data = request.json
        # switch: show run int 
        # router: show ip int br
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of link configurations."}), 400

        # This set is used to track interfaces already configured as trunk on a switch
        trunked_interfaces = set()

        # Start playbook content with one play (applied to all hosts in the "selectedgroup" group)
        playbook_content = """---
- name: Configure multiple links
  hosts: selectedgroup
  gather_facts: no
  tasks:
"""

        # 2) Iterate over each link in the submitted data
        for idx, link in enumerate(data, start=1):
            # Use the key names as sent by the frontend:
            switch_host = link.get("switchHost")
            router_host = link.get("routerHost")
            switch_interface = link.get("switchInterface")
            router_interface = link.get("routerInterface")
            vlan_configs = link.get("vlanConfigs", [])

            # Basic validation
            if not switch_host or not router_host or not switch_interface or not router_interface:
                return jsonify({"error": f"Link #{idx} missing required host or interface information."}), 400

            if not vlan_configs:
                return jsonify({"error": f"Link #{idx} missing VLAN configuration."}), 400

            # For each VLAN configuration in the link, add switch and router tasks
            for vlan_conf in vlan_configs:
                vlan_id = vlan_conf.get("vlanId")
                gateway = vlan_conf.get("gateway")
                cidr = vlan_conf.get("subnet")  # Provided as CIDR (e.g. "24")
                if not vlan_id or not gateway or not cidr:
                    return jsonify({"error": f"Link #{idx}: VLAN configuration incomplete. Required: vlanId, gateway, subnet."}), 400

                # Convert CIDR (e.g. "24") to subnet mask (e.g. "255.255.255.0")
                try:
                    cidr_int = int(cidr)
                    network = ipaddress.IPv4Network(f"0.0.0.0/{cidr_int}", strict=False)
                    netmask = str(network.netmask)
                except Exception as e:
                    return jsonify({"error": f"Link #{idx}: Invalid subnet '{cidr}'. Error: {str(e)}"}), 400

                # -----------------------------------------
                # SWITCH SIDE CONFIGURATION
                # -----------------------------------------
                # Build the list of switch commands to be executed under the parent interface
                if (switch_host, switch_interface) in trunked_interfaces:
                    # Already in trunk mode => add VLAN to allowed list
                    switch_lines = [f"switchport trunk allowed vlan add {vlan_id}"]
                else:
                    # Not configured as trunk yet => configure trunk mode and allowed VLAN
                    switch_lines = [
                        "no switchport mode access",
                        "no switchport access vlan",
                        "switchport mode trunk",
                        f"switchport trunk allowed vlan {vlan_id}"
                    ]
                    # Mark this interface as trunked
                    trunked_interfaces.add((switch_host, switch_interface))

                playbook_content += f"""
  - name: "[Link#{idx}] Configure VLAN {vlan_id} on switch {switch_host}"
    ios_config:
      parents: "interface {switch_interface}"
      lines:
"""
                for cmd in switch_lines:
                    playbook_content += f"        - {cmd}\n"
                playbook_content += f'    when: inventory_hostname == "{switch_host}"\n'

                # -----------------------------------------
                # ROUTER SIDE CONFIGURATION
                # -----------------------------------------
                # Build the router subinterface name by appending a dot and the VLAN ID
                subinterface = f"{router_interface}.{vlan_id}"
                router_commands = [
                    f"encapsulation dot1q {vlan_id}",
                    f"ip address {gateway} {netmask}",
                ]

                playbook_content += f"""
  - name: "[Link#{idx}] Configure no shutdown {router_interface} on router {router_host}"
    ios_config:
      parents: "interface {router_interface}"
      lines:
        - no shutdown
    when: inventory_hostname == "{router_host}"

  - name: "[Link#{idx}] Configure subinterface {subinterface} on router {router_host}"
    ios_config:
      parents: "interface {subinterface}"
      lines:
"""
                for cmd in router_commands:
                    playbook_content += f"        - {cmd}\n"
                playbook_content += f'    when: inventory_hostname == "{router_host}"\n'

        # 3) Write the playbook to the remote VM and (optionally) run it
        ssh, username = create_ssh_connection()  
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Optionally, execute the playbook immediately:
        # stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        # output = stdout.read().decode('utf-8')
        # errors = stderr.read().decode('utf-8')
        # For now, we simply return the playbook content.
        ssh.close()

        return jsonify({
            "message": "Playbook created successfully",
            "playbook": playbook_content,
            # "output": output,       # Uncomment if you run ansible-playbook immediately
            # "errors": errors        # Uncomment if you run ansible-playbook immediately
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/run_playbook/swtosw', methods=['POST'])
def run_playbook_switchswitch():
    try:
        def convert_interface_name(iface):
            """
            แปลงชื่อ interface จากรูปแบบ GigabitEthernet1/0/13 ให้เป็น Gi1/0/13
            """
            if iface.startswith("GigabitEthernet"):
                return "Gi" + iface[len("GigabitEthernet"):]
            return iface

        data = request.json

        # หาก data ไม่ใช่ list ให้แปลงให้เป็น listเพื่อ iterate ได้
        if not isinstance(data, list):
            data = [data]

        # สร้าง SSH connection, run playbook, etc.
        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        errors = stderr.read().decode('utf-8')
        # Check for errors and filter for fatal messages only
        if exit_status != 0 or "FAILED!" in output:
            combined = output.splitlines() + errors.splitlines()
            fatal_error_line = None
            for line in combined:
                if line.strip().startswith("fatal: ["):
                    fatal_error_line = line.strip()
                    break
            if fatal_error_line:
                # Extract the JSON portion after "FAILED! =>"
                match = re.search(r'FAILED! => (.*)', fatal_error_line)
                if match:
                    json_str = match.group(1)
                    try:
                        error_obj = json.loads(json_str)
                        module_stderr = error_obj.get("module_stderr", "")
                        # Remove the last line (typically the command prompt)
                        lines = module_stderr.splitlines()
                        if len(lines) > 1:
                            module_stderr = "\n".join(lines[:-1])
                        # Remove any '%' characters
                        module_stderr = module_stderr.replace("%", "").strip()
                        # Extract device name from the fatal error line, e.g., "fatal: [R101]: ..."
                        device_match = re.search(r'fatal:\s+\[([^\]]+)\]', fatal_error_line)
                        device_name = device_match.group(1) if device_match else ""
                        # Prepend the device name in the desired format
                        module_stderr = f"[{device_name}]: " + module_stderr
                    except Exception as e:
                        module_stderr = "Error parsing JSON: " + str(e)
                else:
                    module_stderr = "No JSON error message found."
            else:
                module_stderr = errors or output
            ssh.close()
            return jsonify({"error": module_stderr}), 500
        time.sleep(4)
        playbook_content = sh_int_trunk()  # สมมติว่าฟังก์ชันนี้ return playbook content ที่ต้องการ
        verify_playbook_path = f"/app/playbook/verify_playbook.yml"

        sftp = ssh.open_sftp()
        with sftp.open(verify_playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()
        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {verify_playbook_path}")
        verify_output = stdout.read().decode('utf-8')
        verify_errors = stderr.read().decode('utf-8')
        ssh.close()

        # Parse output ที่ได้จาก verify_playbook
        parsed_result = parse_sh_int_trunk(verify_output)
        parsed_verify = parse_verify_output(verify_output)
        # ฟังก์ชันสำหรับประมวลผล entry เดียว
        def process_entry(entry):
            req_hostname1 = entry.get("hostname1")
            req_hostname2 = entry.get("hostname2")
            req_iface1 = entry.get("interface1")
            req_iface2 = entry.get("interface2")
            req_vlans = entry.get("vlans", [])

            # แปลง VLANs ใน request ให้เป็นตัวเลขถ้าเป็นตัวเลข
            expected_vlans = []
            for v in req_vlans:
                try:
                    expected_vlans.append(int(v))
                except Exception:
                    expected_vlans.append(v)

            result = {}

            # ประมวลผลสำหรับ hostname1
            conv_iface1 = convert_interface_name(req_iface1)
            host1_result = {"match": False, "parsed_vlans": []}
            if req_hostname1 in parsed_result:
                interfaces = parsed_result[req_hostname1].get("interfaces", {})
                if conv_iface1 in interfaces:
                    parsed_vlans = interfaces[conv_iface1].get("vlan", [])
                    host1_result["parsed_vlans"] = parsed_vlans
                    host1_result["match"] = set(parsed_vlans) == set(expected_vlans)
            result[req_hostname1] = {req_iface1: host1_result}

            # ประมวลผลสำหรับ hostname2
            conv_iface2 = convert_interface_name(req_iface2)
            host2_result = {"match": False, "parsed_vlans": []}
            if req_hostname2 in parsed_result:
                interfaces = parsed_result[req_hostname2].get("interfaces", {})
                if conv_iface2 in interfaces:
                    parsed_vlans = interfaces[conv_iface2].get("vlan", [])
                    host2_result["parsed_vlans"] = parsed_vlans
                    host2_result["match"] = set(parsed_vlans) == set(expected_vlans)
            result[req_hostname2] = {req_iface2: host2_result}

            return result

        # รวมผลลัพธ์จากทุก entry ใน list
        comparison = {}
        for entry in data:
            entry_result = process_entry(entry)
            for hostname, iface_info in entry_result.items():
                if hostname not in comparison:
                    comparison[hostname] = {}
                for iface, res in iface_info.items():
                    comparison[hostname][iface] = res

        # สร้าง list ของคู่ link โดยจับคู่ host ที่มีอยู่ใน comparison แบบ dynamic
        paired_links = []
        for entry in data:
            # ดำเนินการประมวลผล entry เดียว
            entry_result = process_entry(entry)
            req_hostname1 = entry.get("hostname1")
            req_hostname2 = entry.get("hostname2")
            req_iface1 = entry.get("interface1") or entry.get("interface1")  # สมมติว่า key สำหรับ interface ของ host1 คือ 'interface1'
            req_iface2 = entry.get("interface2") or entry.get("interface2")  # และ key สำหรับ host2 คือ 'interface2'

            # สร้าง object สำหรับคู่ link จากข้อมูลใน entry
            paired_links.append({
                "sw1": {
                    "interface": req_iface1,
                    "match": entry_result.get(req_hostname1, {}).get(req_iface1, {}).get("match", False),
                    "parsed_vlans": entry_result.get(req_hostname1, {}).get(req_iface1, {}).get("parsed_vlans", [])
                },
                "sw2": {
                    "interface": req_iface2,
                    "match": entry_result.get(req_hostname2, {}).get(req_iface2, {}).get("match", False),
                    "parsed_vlans": entry_result.get(req_hostname2, {}).get(req_iface2, {}).get("parsed_vlans", [])
                }
            })
        return jsonify({
            "comparison": paired_links,
            "detail": parsed_verify
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/run_playbook/rttort', methods=['POST'])
def run_playbook_routerrouter():
    try:
        data = request.json
        # If data is a list, use all entries' protocol values; otherwise, wrap it in a list.
        protocols = []
        if isinstance(data, list):
            for item in data:
                rt = item.get("routing_tables", {})
                for host, routes in rt.items():
                    for route in routes:
                        p = route.get("protocol")
                        if p:
                            protocols.append(p.lower())
        else:
            rt = data.get("routing_tables", {})
            for host, routes in rt.items():
                for route in routes:
                    p = route.get("protocol")
                    if p:
                        protocols.append(p.lower())
        # Determine the dynamic delay based on the protocols provided:
        if "ospf" in protocols:
            delay = 8
            
        elif "ripv2" in protocols:
            delay = 6
            
        elif "connected" in protocols:
            delay = 2
            
        else:
            delay = 1
            
        # ตรวจสอบว่า data เป็น list หรือไม่ ถ้าใช่ ให้ใช้ตัวแรก
        if isinstance(data, list):
            data = data[0]

        # ข้อมูลที่ได้รับจาก frontend
        req_hostname1 = data.get("hostname1")
        req_hostname2 = data.get("hostname2")
        req_iface1 = data.get("interface1")
        req_iface2 = data.get("interface2")
        req_ipaddress1 = data.get("ip1")
        req_ipaddress2 = data.get("ip2")
        req_subnet = data.get("subnet")
        req_protocol = data.get("protocol")

        expected_tables = data.get("routing_tables", {})

        # สร้าง SSH connection, run playbook, etc.
        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        errors = stderr.read().decode('utf-8')
        # Check for errors and filter for fatal messages only
        if exit_status != 0 or "FAILED!" in output:
            combined = output.splitlines() + errors.splitlines()
            fatal_error_line = None
            for line in combined:
                if line.strip().startswith("fatal: ["):
                    fatal_error_line = line.strip()
                    break
            if fatal_error_line:
                # Extract the JSON portion after "FAILED! =>"
                match = re.search(r'FAILED! => (.*)', fatal_error_line)
                if match:
                    json_str = match.group(1)
                    try:
                        error_obj = json.loads(json_str)
                        module_stderr = error_obj.get("module_stderr", "")
                        # Remove the last line (typically the command prompt)
                        lines = module_stderr.splitlines()
                        if len(lines) > 1:
                            module_stderr = "\n".join(lines[:-1])
                        # Remove any '%' characters
                        module_stderr = module_stderr.replace("%", "").strip()
                        # Extract device name from the fatal error line, e.g., "fatal: [R101]: ..."
                        device_match = re.search(r'fatal:\s+\[([^\]]+)\]', fatal_error_line)
                        device_name = device_match.group(1) if device_match else ""
                        # Prepend the device name in the desired format
                        module_stderr = f"[{device_name}]: " + module_stderr
                    except Exception as e:
                        module_stderr = "Error parsing JSON: " + str(e)
                else:
                    module_stderr = "No JSON error message found."
            else:
                module_stderr = errors or output
            ssh.close()
            return jsonify({"error": module_stderr}), 500

        # add delay to wait for the protocol update
        # Dynamic sleep based on protocol
        time.sleep(delay)

        playbook_content = sh_ip_route()  # สมมติว่าฟังก์ชันนี้ return playbook content ที่ต้องการ
        verify_playbook_path = f"/app/playbook/verify_playbook.yml"

        sftp = ssh.open_sftp()
        with sftp.open(verify_playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {verify_playbook_path}")
        verify_output = stdout.read().decode('utf-8')
        verify_errors = stderr.read().decode('utf-8')
        
        ssh.close()

        parsed_result = parse_routes(verify_output)
        parsed_verify = parse_verify_output(verify_output)
        if expected_tables:
            comparison_result = compare_routing_tables(expected_tables, parsed_result)
        else:
            comparison_result = {"message": "No routing_tables provided. Skipping compare."}
        return jsonify({
            "parsed_routes": parsed_result,
            "comparison": comparison_result,
            "detail": parsed_verify
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/run_playbook/configdevice', methods=['POST'])
def run_playbook_configdevice():
    try:
        data = request.json
        # สร้าง SSH connection, run playbook, etc.
        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/configdevice_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        errors = stderr.read().decode('utf-8')
        # Check for errors and filter for fatal messages only
        if exit_status != 0 or "FAILED!" in output:
            combined = output.splitlines() + errors.splitlines()
            fatal_error_line = None
            for line in combined:
                if line.strip().startswith("fatal: ["):
                    fatal_error_line = line.strip()
                    break
            if fatal_error_line:
                # Extract the JSON portion after "FAILED! =>"
                match = re.search(r'FAILED! => (.*)', fatal_error_line)
                if match:
                    json_str = match.group(1)
                    try:
                        error_obj = json.loads(json_str)
                        module_stderr = error_obj.get("module_stderr", "")
                        # Remove the last line (typically the command prompt)
                        lines = module_stderr.splitlines()
                        if len(lines) > 1:
                            module_stderr = "\n".join(lines[:-1])
                        # Remove any '%' characters
                        module_stderr = module_stderr.replace("%", "").strip()
                        # Extract device name from the fatal error line, e.g., "fatal: [R101]: ..."
                        device_match = re.search(r'fatal:\s+\[([^\]]+)\]', fatal_error_line)
                        device_name = device_match.group(1) if device_match else ""
                        # Prepend the device name in the desired format
                        module_stderr = f"[{device_name}]: " + module_stderr
                    except Exception as e:
                        module_stderr = "Error parsing JSON: " + str(e)
                else:
                    module_stderr = "No JSON error message found."
            else:
                module_stderr = errors or output
            ssh.close()
            return jsonify({"error": module_stderr}), 500

        playbook_content = sh_config_device(data)
        verify_playbook_path = f"/app/playbook/verify_playbook.yml"

        sftp = ssh.open_sftp()
        with sftp.open(verify_playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()
        
        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {verify_playbook_path}")
        verify_output = stdout.read().decode('utf-8')
        verify_errors = stderr.read().decode('utf-8')
        ssh.close()
        
        parsed_result = parse_config_device(verify_output)
        parsed_verify = parse_verify_output(verify_output)
        comparison = compare_config_device(data, parsed_result)
      

        return jsonify({
            "comparison": comparison,
            "detail": parsed_verify
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/run_playbook/swtohost', methods=['POST'])
def run_playbook_switchhost():
    try:
        # Get the JSON payload from the frontend
        data = request.json

        # If data is not a list, convert it to a list to iterate over it
        if not isinstance(data, list):
            data = [data]

        # Create SSH connection
        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        # Execute the first playbook
        stdin, stdout, stderr = ssh.exec_command(
            f"ansible-playbook -i {inventory_path} {playbook_path}"
        )
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        errors = stderr.read().decode('utf-8')
        # Check for errors and filter for fatal messages only
        if exit_status != 0 or "FAILED!" in output:
            combined = output.splitlines() + errors.splitlines()
            fatal_error_line = None
            for line in combined:
                if line.strip().startswith("fatal: ["):
                    fatal_error_line = line.strip()
                    break
            if fatal_error_line:
                # Extract the JSON portion after "FAILED! =>"
                match = re.search(r'FAILED! => (.*)', fatal_error_line)
                if match:
                    json_str = match.group(1)
                    try:
                        error_obj = json.loads(json_str)
                        module_stderr = error_obj.get("module_stderr", "")
                        # Remove the last line (typically the command prompt)
                        lines = module_stderr.splitlines()
                        if len(lines) > 1:
                            module_stderr = "\n".join(lines[:-1])
                        # Remove any '%' characters
                        module_stderr = module_stderr.replace("%", "").strip()
                        # Extract device name from the fatal error line, e.g., "fatal: [R101]: ..."
                        device_match = re.search(r'fatal:\s+\[([^\]]+)\]', fatal_error_line)
                        device_name = device_match.group(1) if device_match else ""
                        # Prepend the device name in the desired format
                        module_stderr = f"[{device_name}]: " + module_stderr
                    except Exception as e:
                        module_stderr = "Error parsing JSON: " + str(e)
                else:
                    module_stderr = "No JSON error message found."
            else:
                module_stderr = errors or output
            ssh.close()
            return jsonify({"error": module_stderr}), 500

        # Generate playbook content using sh_run_int by passing the data from the frontend.
        playbook_content = sh_sw_host(data)
        verify_playbook_path = f"/app/playbook/verify_playbook.yml"

        # Write the generated playbook content to the file on the remote host
        sftp = ssh.open_sftp()
        with sftp.open(verify_playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # Execute the verification playbook
        stdin, stdout, stderr = ssh.exec_command(
            f"ansible-playbook -i {inventory_path} {verify_playbook_path}"
        )
        verify_output = stdout.read().decode('utf-8')
        verify_errors = stderr.read().decode('utf-8')
        ssh.close()

        parsed_result = parse_switch_host(verify_output)
        parsed_verify = parse_verify_output(verify_output)
        comparison = compare_switch_host(data, parsed_result)
        return jsonify({
            "parsed": parsed_result,
            "comparison": comparison,
            "detail":  parsed_verify
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/run_playbook/swtort', methods=['POST'])
def run_playbook_switchrouter():
    try:
        data = request.json
        #router show run int subinterface(eg. g0/1.201 interface.vlan_id)
        #switch show run int
        if isinstance(data, list):
            data = data[0]
        req_switch_host = data.get("switchHost")
        req_router_host = data.get("routerHost")
        req_switch_interface = data.get("switchInterface")
        req_router_interface = data.get("routerInterface")
        req_vlan_configs = data.get("vlanConfigs", [])

        # สร้าง SSH connection, run playbook, etc.
        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/multi_links_playbook.yml"
        inventory_path = f"/app/inventory/inventory.ini"

        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        errors = stderr.read().decode('utf-8')
        # Check for errors and filter for fatal messages only
        if exit_status != 0 or "FAILED!" in output:
            combined = output.splitlines() + errors.splitlines()
            fatal_error_line = None
            for line in combined:
                if line.strip().startswith("fatal: ["):
                    fatal_error_line = line.strip()
                    break
            if fatal_error_line:
                # Extract the JSON portion after "FAILED! =>"
                match = re.search(r'FAILED! => (.*)', fatal_error_line)
                if match:
                    json_str = match.group(1)
                    try:
                        error_obj = json.loads(json_str)
                        module_stderr = error_obj.get("module_stderr", "")
                        # Remove the last line (typically the command prompt)
                        lines = module_stderr.splitlines()
                        if len(lines) > 1:
                            module_stderr = "\n".join(lines[:-1])
                        # Remove any '%' characters
                        module_stderr = module_stderr.replace("%", "").strip()
                        # Extract device name from the fatal error line, e.g., "fatal: [R101]: ..."
                        device_match = re.search(r'fatal:\s+\[([^\]]+)\]', fatal_error_line)
                        device_name = device_match.group(1) if device_match else ""
                        # Prepend the device name in the desired format
                        module_stderr = f"[{device_name}]: " + module_stderr
                    except Exception as e:
                        module_stderr = "Error parsing JSON: " + str(e)
                else:
                    module_stderr = "No JSON error message found."
            else:
                module_stderr = errors or output
            ssh.close()
            return jsonify({"error": module_stderr}), 500

        playbook_content = sh_router_switch(data)  # สมมติว่าฟังก์ชันนี้ return playbook content ที่ต้องการ
        verify_playbook_path = f"/app/playbook/verify_playbook.yml"

        sftp = ssh.open_sftp()
        with sftp.open(verify_playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {verify_playbook_path}")
        verify_output = stdout.read().decode('utf-8')
        verify_errors = stderr.read().decode('utf-8')
        ssh.close()

        parsed_result = parse_router_switch(verify_output)
        parsed_verify = parse_verify_output(verify_output)
        comparison = compare_router_switch(data, parsed_result)

        return jsonify({
            "comparison": comparison,
            "detail": parsed_verify
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/custom_lab', methods=['GET'])
def get_custom_labs():
    try:
        labs = fetch_all_custom_labs()
        return jsonify(labs), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/custom_lab', methods=['POST'])
def create_custom_lab():
    data = request.json
    name = data.get("name")
    description = data.get("description")
    lab_commands = data.get("lab_commands", [])
    try:
        custom_lab_id = create_custom_lab_in_db(name, description, lab_commands)
        response = {
            "id": custom_lab_id,
            "name": name,
            "description": description,
            "lab_commands": lab_commands
        }
        return jsonify(response), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/custom_lab/<int:lab_id>', methods=['PUT'])
def update_custom_lab(lab_id):
    data = request.json
    name = data.get("name")
    description = data.get("description")
    lab_commands = data.get("lab_commands", [])
    try:
        update_custom_lab_in_db(lab_id, name, description, lab_commands)
        return jsonify({"message": "Custom lab updated successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/custom_lab/<int:lab_id>', methods=['DELETE'])
def delete_custom_lab(lab_id):
    try:
        delete_custom_lab_in_db(lab_id)
        return jsonify({"message": "Custom lab deleted successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route('/api/custom_lab/check', methods=['POST'])
def create_playbook_check_lab():
    try:
        # 1) รับข้อมูลจาก request
        data = request.json
        lab_id = data.get("lab_id")
        lab_commands = data.get("lab_commands")
        
        # ตรวจสอบข้อมูลพื้นฐาน
        if not lab_id:
            return jsonify({"error": "Missing lab_id"}), 400
        if not lab_commands or not isinstance(lab_commands, list):
            return jsonify({"error": "Missing lab_commands or lab_commands is not a list"}), 400

        # 2) สร้าง header ของ playbook
        # เราใช้ hosts: all เพราะจะใช้ when conditions ในแต่ละ task
        playbook_content = """---
- name: Check Custom Lab Commands
  hosts: all
  gather_facts: no
  tasks:
"""

        # 3) สร้าง task สำหรับแต่ละ command
        # โดยเราจะ iterate ผ่าน lab_commands และภายในแต่ละ command จะวนลูปตาม host_expected ที่ส่งเข้ามา
        for idx, cmd in enumerate(lab_commands, start=1):
            command_text = cmd.get("command")
            # command_order ไม่ได้ถูกใช้ใน playbook generation นี้ แต่สามารถนำไปใช้งานต่อได้หากต้องการ
            command_order = cmd.get("command_order")
            device_type = cmd.get("device_type")
            host_expected = cmd.get("host_expected", [])
            if not command_text:
                return jsonify({"error": f"Missing command text for command #{idx}"}), 400

            # สร้าง task สำหรับแต่ละ host ตามที่ระบุใน host_expected
            for host in host_expected:
                hostname = host.get("hostname")
                if not hostname:
                    return jsonify({"error": f"Missing hostname for command #{idx}"}), 400

                # สร้าง task สำหรับรันคำสั่ง
                playbook_content += f"""
  - name: "Run {device_type.capitalize()} Command {idx} on {hostname}: {command_text}"
    ios_command:
      commands:
        - "{command_text}"
    register: {device_type}_result_{idx}_{hostname}
    when: inventory_hostname == "{hostname}"
"""
                # สร้าง task สำหรับแสดงผลลัพธ์ (Display)
                playbook_content += f"""
  - name: "Display {device_type.capitalize()} Result {idx} on {hostname}"
    debug:
      msg: "{{{{ {device_type}_result_{idx}_{hostname}.stdout_lines | default('No output', true) }}}}"
    when: {device_type}_result_{idx}_{hostname} is defined and ({device_type}_result_{idx}_{hostname}.stdout_lines | default([])) | length > 0
"""

        # 4) เขียน playbook ลงไฟล์บนเซิร์ฟเวอร์ผ่าน SSH
        ssh, username = create_ssh_connection()
        playbook_path = f"/app/playbook/custom_lab_check.yml"
        inventory_path = f"/app/inventory/inventory.ini"
        
        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # 5) รัน playbook ด้วยคำสั่ง ansible-playbook
        command = f"ansible-playbook -i {inventory_path} {playbook_path}"
        stdin, stdout, stderr = ssh.exec_command(command)
        ansible_output = stdout.read().decode('utf-8')
        ansible_errors = stderr.read().decode('utf-8')
        ssh.close()

        # 6) แยกผลลัพธ์จาก task "Display" ด้วย regex (โดยสมมุติว่ามีฟังก์ชัน parse_ansible_output อยู่)
        parsed_output = parse_ansible_output(ansible_output)
        compare_result = compare_expected_outputs(parsed_output, lab_commands)
        

        # 7) ส่งผลลัพธ์กลับไปยัง Frontend
        return jsonify({
            "parsed_output": parsed_output,
            "comparison": compare_result
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
