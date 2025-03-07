import re

def safe_var(value):
    """
    ฟังก์ชันช่วยเปลี่ยนค่าที่ใช้ในชื่อ variable
    โดยแทนที่อักขระที่ไม่ใช่ a-z, A-Z, 0-9 หรือ _ ด้วย _
    """
    return re.sub(r'[^a-zA-Z0-9_]', '_', str(value))

def sh_config_device(data):
    """
    สร้าง playbook ในรูปแบบ string สำหรับ config device ตามข้อมูลที่ส่งมาจาก frontend
    โดยจะสร้าง tasks ด้วยเงื่อนไข (when) ที่ตรวจสอบ command ของแต่ละ device
    """
    # รองรับทั้งกรณี data เป็น dict หรือ list
    devices = data if isinstance(data, list) else [data]
    plays_str = ""
    
    for device in devices:
        device_type = device.get("deviceType", "").lower()  # เช่น 'switch' หรือ 'router'
        command = device.get("command")
        hostname = device.get("hostname")  # สมมุติว่า hostname ใช้ตรงกับ host ใน inventory
        
        # สร้างชื่อ play ที่มีรายละเอียดมากขึ้น
        play_lines = []
        play_lines.append(f"- name: Configure {device_type.capitalize()} device '{hostname}' with command '{command}'")
        play_lines.append(f"  hosts: {hostname}")
        play_lines.append("  gather_facts: false")
        play_lines.append("  tasks:")
        
        tasks_lines = []
        
        if device_type == "switch":
            # คำสั่งสำหรับ VLAN
            if command == "vlan" and device.get("vlanDataList"):
                for vlan in device.get("vlanDataList", []):
                    # Task สำหรับ show vlan br เมื่อมี vlanId และ vlanName
                    if vlan.get("vlanId") or vlan.get("vlanName"):
                        safe_vlan_id = safe_var(vlan.get("vlanId"))
                        tasks_lines.append(f"    - name: Show VLAN details for VLAN {vlan.get('vlanId')} ({vlan.get('vlanName')})")
                        tasks_lines.append("      ios_command:")
                        tasks_lines.append("        commands:")
                        tasks_lines.append("          - show vlan br")
                        tasks_lines.append(f"      register: vlan_br_output_{safe_vlan_id}")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                        tasks_lines.append(f"    - name: Display VLAN details output for VLAN {vlan.get('vlanId')}")
                        tasks_lines.append("      debug:")
                        tasks_lines.append(f"        msg: \"{{{{ vlan_br_output_{safe_vlan_id}.stdout_lines }}}}\"")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                    # Task สำหรับ show int vlan เมื่อมี ipAddress และ cidr
                    if vlan.get("vlanId") and vlan.get("ipAddress") and vlan.get("cidr"):
                        safe_vlan_id = safe_var(vlan.get("vlanId"))
                        tasks_lines.append(f"    - name: Show interface details for VLAN {vlan.get('vlanId')}")
                        tasks_lines.append("      ios_command:")
                        tasks_lines.append("        commands:")
                        tasks_lines.append(f"          - show run int vlan {vlan.get('vlanId')}")
                        tasks_lines.append(f"      register: int_vlan_output_{safe_vlan_id}")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                        tasks_lines.append(f"    - name: Display interface details output for VLAN {vlan.get('vlanId')}")
                        tasks_lines.append("      debug:")
                        tasks_lines.append(f"        msg: \"{{{{ int_vlan_output_{safe_vlan_id}.stdout_lines }}}}\"")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                    # Task สำหรับ show running config ของ interface ที่มี mode
                    for iface in vlan.get("interfaces", []):
                        if iface.get("interface") and iface.get("mode"):
                            safe_iface = safe_var(iface.get("interface"))
                            tasks_lines.append(f"    - name: Show running config for interface {iface.get('interface')}")
                            tasks_lines.append("      ios_command:")
                            tasks_lines.append("        commands:")
                            tasks_lines.append(f"          - show run int {iface.get('interface')}")
                            tasks_lines.append(f"      register: run_int_output_{safe_iface}")
                            tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                            tasks_lines.append(f"    - name: Display running config output for interface {iface.get('interface')}")
                            tasks_lines.append("      debug:")
                            tasks_lines.append(f"        msg: \"{{{{ run_int_output_{safe_iface}.stdout_lines }}}}\"")
                            tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
            
            # คำสั่งสำหรับ bridge_priority
            elif command == "bridge_priority" and device.get("bridgePriority"):
                bp = device.get("bridgePriority")
                if bp.get("vlan"):
                    safe_vlan = safe_var(bp.get("vlan"))
                    tasks_lines.append(f"    - name: Show spanning-tree details for VLAN {bp.get('vlan')} (Bridge Priority)")
                    tasks_lines.append("      ios_command:")
                    tasks_lines.append("        commands:")
                    tasks_lines.append(f"          - sh spanning-tree vlan {bp.get('vlan')}")
                    tasks_lines.append(f"      register: bridge_priority_output_{safe_vlan}")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                    tasks_lines.append(f"    - name: Display spanning-tree output for VLAN {bp.get('vlan')}")
                    tasks_lines.append("      debug:")
                    tasks_lines.append(f"        msg: \"{{{{ bridge_priority_output_{safe_vlan}.stdout_lines }}}}\"")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
        
        elif device_type == "router":
            # คำสั่งสำหรับ config_ip_router
            if command == "config_ip_router" and device.get("configIp"):
                cip = device.get("configIp")
                if cip.get("interface") and cip.get("ipAddress") and cip.get("cidr"):
                    safe_iface = safe_var(cip.get("interface"))
                    tasks_lines.append(f"    - name: Show running config for interface {cip.get('interface')}")
                    tasks_lines.append("      ios_command:")
                    tasks_lines.append("        commands:")
                    tasks_lines.append(f"          - sh run int {cip.get('interface')}")
                    tasks_lines.append(f"      register: config_ip_output_{safe_iface}")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                    tasks_lines.append(f"    - name: Display 'show running interface on {cip.get('interface')}'")
                    tasks_lines.append("      debug:")
                    tasks_lines.append(f"        msg: \"{{{{ config_ip_output_{safe_iface}.stdout_lines }}}}\"")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
            
            # คำสั่งสำหรับ loopback
            if command == "loopback" and device.get("loopbackData"):
                lb = device.get("loopbackData")
                activate_protocol = lb.get("activateProtocol", "none").lower()
                if lb.get("loopbackNumber") and lb.get("ipAddress"):
                    safe_loop = safe_var(lb.get("loopbackNumber"))
                    tasks_lines.append(f"    - name: Show loopback interface {lb.get('loopbackNumber')}")
                    tasks_lines.append("      ios_command:")
                    tasks_lines.append("        commands:")
                    tasks_lines.append(f"          - sh run int loopback {lb.get('loopbackNumber')}")
                    tasks_lines.append(f"      register: loopback_output_{safe_loop}")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                    tasks_lines.append(f"    - name: Display loopback interface output for {lb.get('loopbackNumber')}")
                    tasks_lines.append("      debug:")
                    tasks_lines.append(f"        msg: \"{{{{ loopback_output_{safe_loop}.stdout_lines }}}}\"")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                
                    if activate_protocol == "ripv2": 
                        safe_loop = safe_var(lb.get("loopbackNumber"))
                        tasks_lines.append(f"    - name: Show loopback running RIPv2 {lb.get('loopbackNumber')}")
                        tasks_lines.append("      ios_command:")
                        tasks_lines.append("        commands:")
                        tasks_lines.append(f"          - sh run | sec rip")
                        tasks_lines.append(f"      register: loopback_rip_output_{safe_loop}")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                        tasks_lines.append(f"    - name: Display loopback running RIPv2 output for {lb.get('loopbackNumber')}")
                        tasks_lines.append("      debug:")
                        tasks_lines.append(f"        msg: \"{{{{ loopback_rip_output_{safe_loop}.stdout_lines }}}}\"")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")

                    if activate_protocol == "ospf": 
                        safe_loop = safe_var(lb.get("loopbackNumber"))
                        tasks_lines.append(f"    - name: Show loopback running OSPF {lb.get('loopbackNumber')}")
                        tasks_lines.append("      ios_command:")
                        tasks_lines.append("        commands:")
                        tasks_lines.append(f"          - sh run | sec ospf")
                        tasks_lines.append(f"      register: loopback_ospf_output_{safe_loop}")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                        tasks_lines.append(f"    - name: Display loopback running OSPF output for {lb.get('loopbackNumber')}")
                        tasks_lines.append("      debug:")
                        tasks_lines.append(f"        msg: \"{{{{ loopback_ospf_output_{safe_loop}.stdout_lines }}}}\"")
                        tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
            
            # คำสั่งสำหรับ static_route
            if command == "static_route" and device.get("staticRouteData"):
                sr = device.get("staticRouteData")
                if sr.get("prefix") and sr.get("cidr") and sr.get("nextHop"):
                    safe_prefix = safe_var(sr.get("prefix"))
                    tasks_lines.append(f"    - name: Show static route for prefix {sr.get('prefix')}")
                    tasks_lines.append("      ios_command:")
                    tasks_lines.append("        commands:")
                    tasks_lines.append("          - sh ip route static")
                    tasks_lines.append(f"      register: static_route_output_{safe_prefix}")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
                    tasks_lines.append(f"    - name: Display static route output for prefix {sr.get('prefix')}")
                    tasks_lines.append("      debug:")
                    tasks_lines.append(f"        msg: \"{{{{ static_route_output_{safe_prefix}.stdout_lines }}}}\"")
                    tasks_lines.append(f"      when: inventory_hostname == '{hostname}'")
        
        # เพิ่ม tasks ลงใน play หากมี task ที่สร้างขึ้น
        if tasks_lines:
            play_lines.extend(tasks_lines)
            plays_str += "\n".join(play_lines) + "\n\n"
    
    return plays_str
