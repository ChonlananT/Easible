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
                print(parse_result)

                for result in parse_result:
                    host_result = result['hostname']
                    switchport = result['switchport']
                    interface = result['interface']

                    # หาก host_result == hostname1 => สร้าง config เฉพาะ hostname1
                    if host_result == hostname1 and vlan_id1 and vlan_name1:
                        playbook_content += f"""
  - name: [Link#{idx}] Configure VLAN on {hostname1}
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
                        if interface == interface1_vlan:
                            if switchport == "access":
                                playbook_content += f"""        - interface {interface1_vlan}
        - switchport mode trunk
        - switchport trunk allowed vlan {vlan_id1}
"""
                            elif switchport == "trunk":
                                playbook_content += f"""        - interface {interface1_vlan}
        - switchport mode trunk
        - switchport trunk allowed vlan add {vlan_id1}
"""

                        playbook_content += f"""    when: inventory_hostname == "{hostname1}"
"""

                    # หาก host_result == hostname2 => สร้าง config เฉพาะ hostname2
                    if host_result == hostname2 and vlan_id2 and vlan_name2:
                        playbook_content += f"""
  - name: [Link#{idx}] Configure VLAN on {hostname2}
    ios_config:
      lines:
        - vlan {vlan_id2}
        - name {vlan_name2}
"""
                        if ip_address2 and netmask2:
                            playbook_content += f"""        - interface vlan {vlan_id2}
        - ip address {ip_address2} {netmask2}
"""
                        if interface == interface2_vlan:
                            if switchport == "access":
                                playbook_content += f"""        - interface {interface2_vlan}
        - switchport mode trunk
        - switchport trunk allowed vlan {vlan_id2}
"""
                            elif switchport == "trunk":
                                playbook_content += f"""        - interface {interface2_vlan}
        - switchport mode trunk
        - switchport trunk allowed vlan add {vlan_id2}
"""
                        playbook_content += f"""    when: inventory_hostname == "{hostname2}"
"""
            elif command == "switchport":
                # ตรวจสอบว่าค่า switchport_mode, interface1, interface2 ครบไหม
                if not switchport_mode or not interface1 or not interface2:
                    return jsonify({"error": f"Link #{idx}: Switchport mode, interface1, and interface2 are required"}), 400

                # ตั้งค่าให้ hostname1
                playbook_content += f"""
  - name: [Link#{idx}] Configure Switchport for {hostname1}
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
  - name: [Link#{idx}] Configure Switchport for {hostname2}
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
  - name: [Link#{idx}] Set Bridge Priority for {hostname1}
    ios_config:
      lines:
        - spanning-tree vlan {vlan} priority {priority1}
    when: inventory_hostname == "{hostname1}"

  - name: [Link#{idx}] Set Bridge Priority for {hostname2}
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
