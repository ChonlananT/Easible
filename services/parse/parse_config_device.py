def parse_config_device(log_text):
    """
    Parse an Ansible log to extract host and message data from ok: blocks,
    and further parse the msg content based on the preceding TASK category.
    (รายละเอียดการ parse ย่อๆ ตามโค้ดเดิม)
    """
    import re
    def clean_value(val):
        return val.strip().strip('",')
    
    block_pattern = re.compile(
        r'(?s)ok: \[([^]]+)\] => \{\s+"msg"\s*:\s*\[\s*\[\s*(.*?)\s*\]\s*\]\s*\}'
    )
    
    results = []
    
    for block_match in block_pattern.finditer(log_text):
        host = clean_value(block_match.group(1))
        raw_msg = block_match.group(2)
        
        pre_block_text = log_text[:block_match.start()]
        task_matches = re.findall(r'TASK \[([^\]]+)\]', pre_block_text)
        task_line = clean_value(task_matches[-1]) if task_matches else ""
        
        msg_lines = [
            clean_value(line)
            for line in raw_msg.splitlines() if line.strip()
        ]
        
        parsed_data = {'host': host, 'task': task_line}
        
        # CATEGORY 1: VLAN details
        if task_line.startswith("Display VLAN details output for VLAN"):
            vlans = []
            for line in msg_lines:
                if not re.match(r'^\d+', line):
                    continue
                m = re.match(r'^(\d+)\s+(\S+)', line)
                if m:
                    vlans.append({
                        'vlanId': clean_value(m.group(1)),
                        'vlanName': clean_value(m.group(2))
                    })
            parsed_data['vlans'] = vlans
        
        # CATEGORY 2: Interface details for VLAN
        elif task_line.startswith("Display interface details output for VLAN"):
            vlan_id = None
            ipaddress = None
            cidr = None
            for line in msg_lines:
                m = re.search(r'interface Vlan(\d+)', line)
                if m:
                    vlan_id = clean_value(m.group(1))
                m_ip = re.search(r'ip address (\S+)\s+(\S+)', line)
                if m_ip:
                    ipaddress = clean_value(m_ip.group(1))
                    cidr = clean_value(m_ip.group(2))
            parsed_data['vlan_details'] = {
                'vlanId': vlan_id,
                'ipaddress': ipaddress,
                'cidr': cidr
            }
        
        # CATEGORY 3: Running config for interface
        elif task_line.startswith("Display running config output for interface"):
            interface = None
            mode = None
            for line in msg_lines:
                m_if = re.search(r'interface (\S+)', line)
                if m_if:
                    interface = clean_value(m_if.group(1))
                m_mode = re.search(r'switchport mode (\S+)', line)
                if m_mode:
                    mode = clean_value(m_mode.group(1))
            parsed_data['interface_config'] = {
                'interface': interface,
                'mode': mode
            }
        
        # CATEGORY 4: Spanning-tree details
        elif task_line.startswith("Display spanning-tree output for VLAN"):
            priority = None
            for line in msg_lines:
                m_prio = re.search(r'\(priority (\d+)', line)
                if m_prio:
                    priority = clean_value(m_prio.group(1))
                    break
            spanning_entries = []
            for line in msg_lines:
                m_entry = re.match(r'(Gi\S+)\s+(\S+)', line)
                if m_entry:
                    spanning_entries.append({
                        'interface': clean_value(m_entry.group(1)),
                        'role': clean_value(m_entry.group(2))
                    })
            parsed_data['spanning_tree'] = {
                'priority': priority,
                'interfaces': spanning_entries
            }
        
        # CATEGORY 5: Interface config output for router
        elif task_line.startswith("Display 'show running interface on"):
            interface = None
            ipaddress = None
            cidr = None
            for line in msg_lines:
                m_if = re.search(r'interface (\S+)', line)
                if m_if:
                    interface = clean_value(m_if.group(1))
                m_ip = re.search(r'ip address (\S+)\s+(\S+)', line)
                if m_ip:
                    ipaddress = clean_value(m_ip.group(1))
                    cidr = clean_value(m_ip.group(2))
            parsed_data['interface_config'] = {
                'interface': interface,
                'ipaddress': ipaddress,
                'cidr': cidr
            }
        
        # CATEGORY 6: Loopback interface output
        elif task_line.startswith("Display loopback interface output for"):
            interface = None
            ipaddress = None
            cidr = None
            for line in msg_lines:
                m_if = re.search(r'interface (\S+)', line)
                if m_if:
                    interface = clean_value(m_if.group(1))
                m_ip = re.search(r'ip address (\S+)\s+(\S+)', line)
                if m_ip:
                    ipaddress = clean_value(m_ip.group(1))
                    cidr = clean_value(m_ip.group(2))
            parsed_data['loopback'] = {
                'interface': interface,
                'ipaddress': ipaddress,
                'cidr': cidr,
            }

        # CATEGORY 6.1: Loopback ripv2 output
        elif task_line.startswith("Display loopback running RIPv2 output for"):
            activateProtocol = None
            for line in msg_lines:
                m_ap = re.search(r'router (\S+)', line)
                if m_ap:
                    activateProtocol = clean_value(m_ap.group(1))

            # Now just merge the protocol field
            if 'loopback' not in parsed_data:
                parsed_data['loopback'] = {}
            parsed_data['loopback']['activateProtocol'] = activateProtocol + "v2"

        # CATEGORY 6.2: Loopback ospf output
        elif task_line.startswith("Display loopback running OSPF output for"):
            interface = None
            ipaddress = None
            cidr = None
            activateProtocol = None
            for line in msg_lines:
                m_ap = re.search(r'router (\S+)', line)
                if m_ap:
                    activateProtocol = clean_value(m_ap.group(1))
                m_ip = re.search(r'network (\S+)\s+(\S+)', line)
                if m_ip:
                    ipaddress = clean_value(m_ip.group(1))
                if 'loopback' not in parsed_data:
                    parsed_data['loopback'] = {}
                    parsed_data['loopback']['activateProtocol'] = activateProtocol
        
        # CATEGORY 7: Static route details
        elif task_line.startswith("Display static route output for prefix"):
            routes = []
            prev_subnet_cidr = None
            for line in msg_lines:
                m_subnet = re.search(r'^\s*(\d+\.\d+\.\d+\.\d+\/(\d+))\s+is subnetted', line)
                if m_subnet:
                    prev_subnet_cidr = clean_value(m_subnet.group(2))
                    continue
                
                m_route = re.search(r'^S\s+(\d+\.\d+\.\d+\.\d+)(?:/(\d+))?.*via\s+(\S+)', line)
                if m_route:
                    prefix = clean_value(m_route.group(1))
                    cidr = clean_value(m_route.group(2)) if m_route.group(2) else prev_subnet_cidr
                    nexthop = clean_value(m_route.group(3))
                    routes.append({
                        'prefix': prefix,
                        'cidr': cidr,
                        'nexthop': nexthop
                    })
            parsed_data['static_routes'] = routes
        
        results.append(parsed_data)
    
    # --- Merge results by host and task (หรือ command) ---
    # สมมุติว่าหากมีหลาย entry สำหรับ host เดียวกันและ task เดียวกัน เราต้องการรวมเข้าด้วยกัน
    merged = {}
    for entry in results:
        # key โดยใช้ hostname + task (หรือสามารถปรับให้เป็น command ได้)
        key = (entry.get("host"), entry.get("task"))
        if key not in merged:
            merged[key] = entry
        else:
            # ถ้ามี key เดียวกัน เราจะ merge โดยอัพเดท dictionary 
            # สำหรับ field ที่เป็น list จะ extend ส่วนสำหรับ dict ให้ update
            for k, v in entry.items():
                if k in merged[key]:
                    if isinstance(v, list):
                        merged[key][k].extend(v)
                    elif isinstance(v, dict):
                        merged[key][k].update(v)
                    else:
                        merged[key][k] = v  # override
                else:
                    merged[key][k] = v
    return list(merged.values())
