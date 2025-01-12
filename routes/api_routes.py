import re
import ipaddress
from flask import Blueprint, request, jsonify
from services.ssh_service import create_ssh_connection
from services.parse import parse_result, parse_interface, parse_switchport
from services.ansible_playbook import generate_playbook
from services.database import add_device, fetch_all_devices, delete_device
from services.generate_inventory import generate_inventory_content
from services.sh_ip_int_br import sh_ip_int_br
from services.cidr import cidr_to_subnet_mask
from services.parse import parse_switchport
from services.calculate_network_id import calculate_network_id

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
        print(parse_result)
        ssh.close()

        # Return the structured data
        return jsonify({"parsed_result": parsed_result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_playbook_swtosw', methods=['POST'])
def create_playbook():
    try:
        # 1) ดึงข้อมูลจาก request
        data = request.json

        # สมมติว่า frontend ส่งมาเป็น array (หลายลิงก์)
        # ถ้าเป็น single link แบบเดิมจะเป็น dict ธรรมดา -> ควรรองรับได้ทั้งสองแบบ
        if isinstance(data, dict):
            # แปลงให้เป็น list 1 ตัว เพื่อใช้ logic เดียวกัน
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of link configurations."}), 400

        # NOTE: ในตัวอย่างนี้จะสร้าง playbook ใหญ่เพียงไฟล์เดียว
        # แล้วรวม tasks ของทุกลิงก์เข้าไปใน playbook นี้
        # (เพื่อความง่าย; ถ้าต้องการแยกเป็นไฟล์ละลิงก์ หรือไฟล์ละ command ก็ทำได้เช่นกัน)

        # ส่วนหัวของ playbook
        # จะเป็น play เดียว ที่รันกับ hosts: all (หรือจะเจาะจงชื่อ host รวมกันใน hosts: ... ก็ได้)
        # ในตัวอย่างนี้ใช้ "all" + เงื่อนไข when ว่า inventory_hostname == "SW1" หรือ "SW2" ฯลฯ
        trunked_interfaces = set()
        playbook_content = """---
- name: Configure multiple links
  hosts: all
  gather_facts: no
  tasks:
"""
        # 2) สะสม tasks จากแต่ละลิงก์
        for idx, link in enumerate(data, start=1):
            hostname1 = link.get("hostname1")
            hostname2 = link.get("hostname2")
            command = link.get("command")
            vlan_data = link.get("vlanData", {})
            switchport_mode = link.get("switchportMode")
            interface1 = link.get("interface1")
            interface2 = link.get("interface2")
            bridge_priority = link.get("bridgePriority", {})

            # Basic validation
            if not hostname1 or not hostname2 or not command:
                # หากลิงก์ไหนข้อมูลไม่ครบ จะส่ง error กลับไปทั้งหมด หรือจะข้ามลิงก์นี้เลยก็ได้
                return jsonify({"error": f"Link #{idx} missing hostname1, hostname2, or command"}), 400

            # สร้าง tasks ตาม command
            if command == "vlan":
                vlan_id1 = vlan_data.get("vlanId1")
                vlan_name1 = vlan_data.get("vlanName1")
                vlan_id2 = vlan_data.get("vlanId2")
                vlan_name2 = vlan_data.get("vlanName2")

                ip_address1 = vlan_data.get("ipAddress1")
                subnet_mask1 = vlan_data.get("subnetMask1")
                ip_address2 = vlan_data.get("ipAddress2")
                subnet_mask2 = vlan_data.get("subnetMask2")

                interface1_vlan = vlan_data.get("interface1")
                interface2_vlan = vlan_data.get("interface2")

                # ฟังก์ชันช่วยคำนวณ subnet
                def calculate_subnet(ip, mask):
                    try:
                        network = ipaddress.IPv4Network(f"{ip}/{mask}", strict=False)
                        return network.network_address, network.netmask
                    except ValueError as e:
                        return None, str(e)

                subnet1, netmask1 = (None, None)
                if ip_address1 and subnet_mask1:
                    network_addr1, netm1 = calculate_subnet(ip_address1, subnet_mask1)
                    if network_addr1 is not None:
                        # ถ้าคำนวณสำเร็จ
                        subnet1, netmask1 = str(network_addr1), str(netm1)

                subnet2, netmask2 = (None, None)
                if ip_address2 and subnet_mask2:
                    network_addr2, netm2 = calculate_subnet(ip_address2, subnet_mask2)
                    if network_addr2 is not None:
                        subnet2, netmask2 = str(network_addr2), str(netm2)

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

                for result in parse_result:
                    host_result = result['hostname']
                    switchport = result['switchport']
                    interface = result['interface']

                    # หาก host_result == hostname1 => สร้าง config เฉพาะ hostname1
                    if host_result == hostname1 and vlan_id1 and vlan_name1:
                        playbook_content += f"""
  - name: "[Link#{idx}] Configure VLAN on {hostname1}"
    ios_config:
      lines:
        - vlan {vlan_id1}
        - name {vlan_name1}
"""
                        # ถ้าต้องการ config IP บน interface VLAN
                        if ip_address1 and netmask1:
                            playbook_content += f"""        - interface vlan {vlan_id1}
        - ip address {ip_address1} {netmask1}
"""
                        # เช็คว่า interface ที่กลับมาจาก parse_switchport ตรงกับ interface1_vlan ไหม
                        # แล้วค่อยสั่ง switchport mode trunk หรือ trunk allowed vlan ...
                        interface1_vlan_lower = interface1_vlan.lower() if interface1_vlan else None
                        if interface == interface1_vlan:
                            if switchport == "access":
                                if (host_result, interface) in trunked_interfaces:
                                    playbook_content += f"""        - interface {interface1_vlan_lower}
        - switchport trunk allowed vlan add {vlan_id1}
"""
                                else:
                                    # ครั้งแรก => สั่ง trunk allowed vlan
                                    playbook_content += f"""        - interface {interface1_vlan_lower}
        - switchport mode trunk
        - switchport trunk allowed vlan {vlan_id1}
"""
                                    trunked_interfaces.add((host_result, interface))
                            elif switchport == "trunk":
                                playbook_content += f"""        - interface {interface1_vlan_lower}
        - switchport mode trunk
        - switchport trunk allowed vlan add {vlan_id1}
"""
                                trunked_interfaces.add((host_result, interface))

                        playbook_content += f"""    when: inventory_hostname == "{hostname1}"
"""

                    # หาก host_result == hostname2 => สร้าง config เฉพาะ hostname2
                    if host_result == hostname2 and vlan_id2 and vlan_name2:
                        playbook_content += f"""
  - name: "[Link#{idx}] Configure VLAN on {hostname2}"
    ios_config:
      lines:
        - vlan {vlan_id2}
        - name {vlan_name2}
"""
                        if ip_address2 and netmask2:
                            playbook_content += f"""        - interface vlan {vlan_id2}
        - ip address {ip_address2} {netmask2}
"""
                        interface2_vlan_lower = interface2_vlan.lower() if interface2_vlan else None
                        if interface == interface2_vlan:
                            if switchport == "access":
                                if (host_result, interface) in trunked_interfaces:
                                    playbook_content += f"""        - interface {interface2_vlan_lower}
        - switchport trunk allowed vlan add {vlan_id2}
"""
                                else:
                                    # ครั้งแรก => สั่ง trunk allowed vlan
                                    playbook_content += f"""        - interface {interface2_vlan_lower}
        - switchport mode trunk
        - switchport trunk allowed vlan {vlan_id2}
"""
                                    trunked_interfaces.add((host_result, interface))    
                            elif switchport == "trunk":
                                playbook_content += f"""        - interface {interface2_vlan_lower}
        - switchport mode trunk
        - switchport trunk allowed vlan add {vlan_id2}
"""
                                trunked_interfaces.add((host_result, interface))
                        playbook_content += f"""    when: inventory_hostname == "{hostname2}"
"""
            elif command == "switchport":
                # ตรวจสอบว่าค่า switchport_mode, interface1, interface2 ครบไหม
                if not switchport_mode or not interface1 or not interface2:
                    return jsonify({"error": f"Link #{idx}: Switchport mode, interface1, and interface2 are required"}), 400

                # ตั้งค่าให้ hostname1
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
                else:  # trunk
                    playbook_content += f"""        - switchport mode trunk
"""

                playbook_content += f"""    when: inventory_hostname == "{hostname1}"
"""

                # ตั้งค่าให้ hostname2
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
                else:  # trunk
                    playbook_content += f"""        - switchport mode trunk
"""

                playbook_content += f"""    when: inventory_hostname == "{hostname2}"
"""

            elif command == "bridge_priority":
                vlan = bridge_priority.get("vlan")
                priority1 = bridge_priority.get("priority1")
                priority2 = bridge_priority.get("priority2")

                if not vlan or not priority1 or not priority2:
                    return jsonify({"error": f"Link #{idx}: VLAN and both priorities are required"}), 400

                playbook_content += f"""
  - name: "[Link#{idx}] Set Bridge Priority for {hostname1}"
    ios_config:
      lines:
        - spanning-tree vlan {vlan} priority {priority1}
    when: inventory_hostname == "{hostname1}"

  - name: "[Link#{idx}] Set Bridge Priority for {hostname2}"
    ios_config:
      lines:
        - spanning-tree vlan {vlan} priority {priority2}
    when: inventory_hostname == "{hostname2}"
"""

            else:
                return jsonify({"error": f"Link #{idx}: Unsupported command"}), 400

        # 3) หลังจากรวม tasks ของทุกลิงก์แล้ว -> เขียน playbook ลงไปบนเซิร์ฟเวอร์ และเรียก ansible-playbook
        ssh, username = create_ssh_connection()  
        playbook_path = f"/home/{username}/playbook/multi_links_playbook.yml"
        inventory_path = f"/home/{username}/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # จะเรียก ansible-playbook ทันทีเลยหรือไม่ ก็แล้วแต่ workflow
        # ตัวอย่าง เรียกเลย:
        # stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        # output = stdout.read().decode('utf-8')
        # errors = stderr.read().decode('utf-8')
        # ...

        ssh.close()

        # return playbook_content หรือ output กลับไป
        return jsonify({
            "message": "Playbook created successfully",
            "playbook": playbook_content,
            # "output": output,       # ถ้าคุณรัน ansible-playbook ไปแล้ว
            # "errors": errors        # ถ้าคุณรัน ansible-playbook ไปแล้ว
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/create_playbook_rttort', methods=['POST'])
def create_playbook_routerrouter():
    try:
        data = request.json

        # ถ้าเป็น single object -> แปลงเป็น list
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of link configurations."}), 400

        # ส่วนหัวของ playbook
        playbook_content = """---
- name: Configure router-router links
  hosts: all
  gather_facts: no
  tasks:
"""

        # Loop ทีละ link
        for idx, link in enumerate(data, start=1):
            hostname1 = link.get("hostname1")
            hostname2 = link.get("hostname2")
            interface1 = link.get("interface1")
            interface2 = link.get("interface2")
            ip1 = link.get("ipAddress1")
            ip2 = link.get("ipAddress2")
            cidr = link.get("cidr")
            protocol = link.get("protocol")
            static_route1 = link.get("staticRoute1")
            static_route2 = link.get("staticRoute2")

            # ตรวจสอบค่าเบื้องต้น
            if not (hostname1 and hostname2 and interface1 and interface2 and ip1 and ip2 and cidr):
                return jsonify({"error": f"Link #{idx}: missing required fields"}), 400
            
            subnet1 = cidr_to_subnet_mask(static_route1['cidr']) if protocol and protocol.lower() == 'static' and static_route1 else cidr_to_subnet_mask(cidr)
            subnet2 = cidr_to_subnet_mask(static_route2['cidr']) if protocol and protocol.lower() == 'static' and static_route2 else cidr_to_subnet_mask(cidr)

            # คำนวณ Subnet Mask (เช่น /24 -> 255.255.255.0)
            try:
                network1 = ipaddress.ip_network(f"{ip1}/{cidr}", strict=False)
                netmask1 = str(network1.netmask)
            except ValueError as e:
                return jsonify({"error": f"Link #{idx} invalid IP or CIDR: {e}"}), 400

            try:
                network2 = ipaddress.ip_network(f"{ip2}/{cidr}", strict=False)
                netmask2 = str(network2.netmask)
            except ValueError as e:
                return jsonify({"error": f"Link #{idx} invalid IP or CIDR: {e}"}), 400

            # สร้าง task สำหรับ config IP บน Host1
            playbook_content += f"""
  - name: "[Link#{idx}] Config IP on {hostname1}"
    ios_config:
      lines:
        - interface {interface1}
        - ip address {ip1} {netmask1}
        - no shutdown
    when: inventory_hostname == "{hostname1}"
"""

            # สร้าง task สำหรับ config IP บน Host2
            playbook_content += f"""
  - name: "[Link#{idx}] Config IP on {hostname2}"
    ios_config:
      lines:
        - interface {interface2}
        - ip address {ip2} {netmask2}
        - no shutdown
    when: inventory_hostname == "{hostname2}"
"""

            # ถ้า protocol != none ก็เพิ่ม tasks ต่อ
            if protocol and protocol.lower() != "none":
                if protocol.lower() == "rip":
                    # ตัวอย่าง config RIP (version 2 + network)
                    # อาจต้องคำนวณ network address
                    netaddr1 = str(network1.network_address)
                    netaddr2 = str(network2.network_address)
                    
                    playbook_content += f"""
  - name: "[Link#{idx}] Configure RIP on {hostname1}"
    ios_config:
      lines:
        - router rip
        - version 2
        - network {netaddr1}
      when: inventory_hostname == "{hostname1}"
"""

                    playbook_content += f"""
  - name: "[Link#{idx}] Configure RIP on {hostname2}"
    ios_config:
      lines:
        - router rip
        - version 2
        - network {netaddr2}
      when: inventory_hostname == "{hostname2}"
"""

                elif protocol.lower() == "ospf":
                    # ตัวอย่าง OSPF process 1 + network ... area 0
                    # สมมติใช้ wildcard mask = 0.0.0.255 ถ้า /24 
                    # (ในงานจริงอาจต้องคำนวณตาม cidr)
                    netaddr1 = str(network1.network_address)
                    netaddr2 = str(network2.network_address)

                    # ตัวอย่าง simplistic (ทุก interface area 0)
                    playbook_content += f"""
  - name: "[Link#{idx}] Configure OSPF on {hostname1}"
    ios_config:
      lines:
        - router ospf 1
        - network {ip1} 0.0.0.0 area 0
      when: inventory_hostname == "{hostname1}"
"""

                    playbook_content += f"""
  - name: "[Link#{idx}] Configure OSPF on {hostname2}"
    ios_config:
      lines:
        - router ospf 1
        - network {ip2} 0.0.0.0 area 0
      when: inventory_hostname == "{hostname2}"
"""

                elif protocol.lower() == "static":
                    # ตรวจสอบว่ามี staticRoute1 และ staticRoute2 หรือไม่
                    if not (static_route1 and static_route1.get("prefix") and static_route1.get("subnet") and static_route1.get("nextHop") and
                            static_route2 and static_route2.get("prefix") and static_route2.get("subnet") and static_route2.get("nextHop")):
                        return jsonify({"error": f"Link #{idx}: Incomplete staticRoute details"}), 400

                    prefix1 = static_route1.get("prefix")
                    cidr1 = static_route1.get("cidr")
                    nextHop1 = static_route1.get("nextHop")
                    subnet_route1 = cidr_to_subnet_mask(cidr1)

                    prefix2 = static_route2.get("prefix")
                    cidr2 = static_route2.get("cidr")
                    nextHop2 = static_route2.get("nextHop")
                    subnet_route2 = cidr_to_subnet_mask(cidr2)

                    # คำนวณ Network ID สำหรับ Static Route
                    try:
                        network_static1 = calculate_network_id(static_route1['prefix'], static_route1['cidr'])
                        subnet_static1 = str(ipaddress.IPv4Network(f"{static_route1['prefix']}/{static_route1['cidr']}", strict=False).netmask)
                    except ValueError as e:
                        return jsonify({"error": f"Link #{idx} staticRoute1 error: {e}"}), 400

                    try:
                        network_static2 = calculate_network_id(static_route2['prefix'], static_route2['cidr'])
                        subnet_static2 = str(ipaddress.IPv4Network(f"{static_route2['prefix']}/{static_route2['cidr']}", strict=False).netmask)
                    except ValueError as e:
                        return jsonify({"error": f"Link #{idx} staticRoute2 error: {e}"}), 400

                    # สร้าง task สำหรับ Static Route บน Host1
                    playbook_content += f"""
  - name: "[Link#{idx}] Configure Static Route on {hostname1}"
    ios_config:
      lines:
        - ip route {network_static1} {subnet_static1} {static_route1['nextHop']}
      when: inventory_hostname == "{hostname1}"
"""

                    # สร้าง task สำหรับ Static Route บน Host2
                    playbook_content += f"""
  - name: "[Link#{idx}] Configure Static Route on {hostname2}"
    ios_config:
      lines:
        - ip route {network_static2} {subnet_static2} {static_route2['nextHop']}
      when: inventory_hostname == "{hostname2}"
"""
                else:
                    # ถ้า protocol ไม่รู้จัก ก็ข้าม หรือ return error
                    pass

        # หลังจากรวม tasks ทุกลิงก์แล้ว -> เขียน playbook ลงไฟล์
        ssh, username = create_ssh_connection()
        playbook_path = f"/home/{username}/playbook/routerrouter_playbook.yml"
        inventory_path = f"/home/{username}/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        ssh.close()

        return jsonify({
            "message": "Router-Router playbook created successfully",
            "playbook": playbook_content
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route('/api/create_playbook_configdevice', methods=['POST'])
def create_playbook_configdevice():
    try:
        # 1) ดึงข้อมูลจาก request
        data = request.json
        print(data)

        # สมมติว่า frontend ส่งมาเป็น array (หลายคำสั่ง)
        # ถ้าเป็น single command แบบเดิมจะเป็น dict ธรรมดา -> ควรรองรับได้ทั้งสองแบบ
        if isinstance(data, dict):
            # แปลงให้เป็น list 1 ตัว เพื่อใช้ logic เดียวกัน
            data = [data]
        elif not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of command configurations."}), 400

        # ส่วนหัวของ playbook
        playbook_content = """---
- name: Configure Device Commands
  hosts: all
  gather_facts: no
  tasks:
"""

        # ใช้ set เพื่อเก็บ interface ที่ถูกกำหนดเป็น trunk แล้ว
        trunked_interfaces = set()

        # 2) สะสม tasks จากแต่ละคำสั่ง
        for idx, cmd in enumerate(data, start=1):
            cmd_type = cmd.get("command")  # เปลี่ยนจาก "type" เป็น "command"
            device_type = cmd.get("deviceType")
            host = cmd.get("hostname")  # เปลี่ยนจาก "host" เป็น "hostname"

            if not cmd_type or not device_type or not host:
                return jsonify({"error": f"Command #{idx}: Missing command, deviceType, or hostname field."}), 400

            if device_type not in ["switch", "router"]:
                return jsonify({"error": f"Command #{idx}: Unsupported deviceType '{device_type}'."}), 400

            if cmd_type == "vlan":
                if device_type != "switch":
                    return jsonify({"error": f"Command #{idx}: VLAN command is only applicable to switches."}), 400

                vlan_data = cmd.get("vlanData", {})
                vlan_id = vlan_data.get("vlanId")
                vlan_name = vlan_data.get("vlanName")
                ip_address = vlan_data.get("ipAddress")
                cidr = vlan_data.get("cidr")
                interface = vlan_data.get("interface")
                switchport_mode = vlan_data.get("mode")  # เปลี่ยนจาก "switchportMode" เป็น "mode"

                # Validation
                if not vlan_id or not interface or not switchport_mode:
                    return jsonify({"error": f"Command #{idx}: VLAN ID, Interface, and Mode are required."}), 400

                # หากกำหนด IP Address ต้องกำหนด CIDR ด้วย
                if ip_address and not cidr:
                    return jsonify({"error": f"Command #{idx}: CIDR is required when IP Address is specified."}), 400

                # คำนวณ Network ID จาก Prefix และ CIDR (สำหรับ IP Address)
                network_id = ""
                subnet_mask = ""
                if ip_address and cidr:
                    try:
                        network_id = calculate_network_id(ip_address, cidr)
                        subnet_mask = str(ipaddress.IPv4Network(f"{ip_address}/{cidr}", strict=False).netmask)
                    except ValueError as e:
                        return jsonify({"error": f"Command #{idx}: {str(e)}"}), 400

                # สร้าง Playbook Checker สำหรับตรวจสอบ Switchport Mode
                playbook_content_checker = f"""
- name: check VLAN on specific host
  hosts: {host}
  gather_facts: no
  tasks:
"""

                if interface:
                    playbook_content_checker += f"""
  - name: Run 'show run interface {interface}' command on {host}
    ios_command:
      commands:
        - show run interface {interface}
    register: interface_output

  - name: Filter interface details on {host}
    debug:
      msg: "{{{{ interface_output.stdout_lines }}}}"
    when: interface_output is defined
"""

                # เขียน playbook_checker ลงไฟล์
                ssh, username = create_ssh_connection()
                inventory_path = f"/home/{username}/inventory/inventory.ini"
                playbook_checker_path = f"/home/{username}/playbook/vlanchecker_{idx}.yml"
                sftp = ssh.open_sftp()
                with sftp.open(playbook_checker_path, "w") as playbook_file:
                    playbook_file.write(playbook_content_checker)
                sftp.close()

                # รัน playbook_checker
                ansible_command = f"ansible-playbook -i {inventory_path} {playbook_checker_path}"
                stdin, stdout, stderr = ssh.exec_command(ansible_command)
                output = stdout.read().decode("utf-8")
                error = stderr.read().decode("utf-8")
                ssh.close()

                # แยกผลลัพธ์จาก playbook_checker
                parse_result = parse_switchport(output)

                print(parse_result)

                # ตรวจสอบ Switchport Mode และกำหนดคำสั่ง switchport ตามที่ต้องการ
                for result in parse_result:
                    host_result = result['hostname']
                    switchport = result['switchport']
                    interface_result = result['interface']

                    # กำหนดคำสั่งสำหรับ VLAN
                    playbook_content += f"""
  - name: "[Command#{idx}] Configure VLAN {vlan_id} on {host_result}"
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

                    playbook_content += f"""    when: inventory_hostname == "{host_result}"
"""

                    # กำหนดคำสั่ง Switchport Mode ตาม Switchport Mode ที่ตรวจสอบได้
                    if switchport_mode == "access":
                        # ถ้าเป็น access, ไม่ต้องเพิ่ม switchport trunk allowed vlan
                        playbook_content += f"""
  - name: "[Command#{idx}] Configure Switchport Access Mode on {interface_result}"
    ios_config:
      parents: interface {interface_result}
      lines:
        - switchport mode access
    when: inventory_hostname == "{host_result}"
"""
                    elif switchport_mode == "trunk":
                        # ถ้าเป็น trunk, เพิ่ม switchport trunk allowed vlan add {vlan_id}
                        if (host_result, interface_result) in trunked_interfaces:
                            playbook_content += f"""
  - name: "[Command#{idx}] Add VLAN {vlan_id} to existing trunk on {interface_result}"
    ios_config:
      parents: interface {interface_result}
      lines:
        - switchport trunk allowed vlan add {vlan_id}
    when: inventory_hostname == "{host_result}"
"""
                        else:
                            playbook_content += f"""
  - name: "[Command#{idx}] Set trunk mode and allow VLAN {vlan_id} on {interface_result}"
    ios_config:
      parents: interface {interface_result}
      lines:
        - switchport mode trunk
        - switchport trunk allowed vlan {vlan_id}
    when: inventory_hostname == "{host_result}"
"""
                            trunked_interfaces.add((host_result, interface_result))

            elif cmd_type == "bridge_priority":
                if device_type != "switch":
                    return jsonify({"error": f"Command #{idx}: Bridge Priority command is only applicable to switches."}), 400

                bridge_priority = cmd.get("bridgePriority", {})
                vlan = bridge_priority.get("vlan")
                priority = bridge_priority.get("priority")

                # Validation
                if vlan is None or priority is None:
                    return jsonify({"error": f"Command #{idx}: VLAN and Priority are required."}), 400

                # กำหนดคำสั่งสำหรับ Bridge Priority
                playbook_content += f"""
  - name: "[Command#{idx}] Set Bridge Priority for VLAN {vlan} on {host}"
    ios_config:
      lines:
        - spanning-tree vlan {vlan} priority {priority}
    when: inventory_hostname == "{host}"
"""

            elif cmd_type == "config_ip_router":
                # คำสั่งนี้สามารถใช้ได้กับทั้ง switch และ router
                config_ip = cmd.get("configIp", {})
                interface = config_ip.get("interface")
                ip_address = config_ip.get("ipAddress")
                cidr = config_ip.get("cidr")

                # Validation
                if not interface or not ip_address or not cidr:
                    return jsonify({"error": f"Command #{idx}: Interface, IP Address, and CIDR are required."}), 400

                # คำนวณ Network ID จาก Prefix และ CIDR
                try:
                    network_id = calculate_network_id(ip_address, cidr)
                    subnet_mask = str(ipaddress.IPv4Network(f"{ip_address}/{cidr}", strict=False).netmask)
                except ValueError as e:
                    return jsonify({"error": f"Command #{idx}: {str(e)}"}), 400

                # กำหนดคำสั่ง Config IP Router
                playbook_content += f"""
  - name: "[Command#{idx}] Configure IP Address on Interface {interface} on {host}"
    ios_config:
      lines:
        - interface {interface}
        - ip address {ip_address} {subnet_mask}
    when: inventory_hostname == "{host}"
"""

            else:
                return jsonify({"error": f"Command #{idx}: Unsupported command type '{cmd_type}'."}), 400

        # 3) หลังจากรวม tasks ของทุกคำสั่งแล้ว -> เขียน playbook ลงไปบนเซิร์ฟเวอร์ และเรียก ansible-playbook
        ssh, username = create_ssh_connection()
        playbook_path = f"/home/{username}/playbook/configdevice_playbook.yml"
        inventory_path = f"/home/{username}/inventory/inventory.ini"

        sftp = ssh.open_sftp()
        with sftp.open(playbook_path, "w") as playbook_file:
            playbook_file.write(playbook_content)
        sftp.close()

        # สามารถเลือกที่จะรัน Playbook ทันทีได้โดย uncomment ส่วนนี้
        # stdin, stdout, stderr = ssh.exec_command(f"ansible-playbook -i {inventory_path} {playbook_path}")
        # output = stdout.read().decode("utf-8")
        # error = stderr.read().decode("utf-8")
        # if error:
        #     return jsonify({"error": f"Ansible Playbook Error: {error}"}), 500

        ssh.close()

        # return playbook_content หรือ output กลับไป
        return jsonify({
            "message": "Playbook created successfully",
            "playbook": playbook_content,
            # "output": output,       # ถ้าคุณรัน ansible-playbook ไปแล้ว
            # "errors": error         # ถ้าคุณรัน ansible-playbook ไปแล้ว
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
