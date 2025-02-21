def netmask_to_cidr(netmask):
    """
    แปลง netmask แบบ dotted decimal (เช่น '255.255.255.0') เป็น CIDR (เช่น '24')
    """
    try:
        return str(sum(bin(int(octet)).count("1") for octet in netmask.split(".")))
    except Exception:
        return None

def compare_router_switch(data, parsed_result):
    """
    เปรียบเทียบข้อมูลจาก frontend (data) กับ parsed_result
    - data: ข้อมูลจาก frontend ซึ่งมี keys:
          routerHost, routerInterface, switchHost, switchInterface, vlanConfigs (list ของ dict ที่มี vlanId, gateway, subnet)
    - parsed_result: list ของ dict ที่ได้จากการ parse output playbook
          ตัวอย่างเช่น:
            {'host': 'SW101', 'type': 'switch', 'interface': 'GigabitEthernet1/0/14', 'vlan_id': '203,210'}
            {'host': 'R102', 'type': 'router', 'interface': 'GigabitEthernet0/1.203', 'vlan_id': '203', 'ip_address': '1.1.1.1', 'subnet': '255.255.255.0'}
            {'host': 'R102', 'type': 'router', 'interface': 'GigabitEthernet0/1.210', 'vlan_id': '210', 'ip_address': '1.1.2.1', 'subnet': '255.255.255.0'}
    
    คืนค่าเป็น dict ที่มีรายละเอียดเปรียบเทียบของ switch และ router ในรูปแบบ:
        {
          "switch": {
              "frontend": {"interface": ..., "vlans": [...]},
              "backend": {"interface": ..., "vlans": [...]},
              "match": true|false,
              "message": <ข้อความอธิบาย>
          },
          "router": {
              <vlanId>: {
                  "frontend": {"interface": <routerInterface>.<vlanId>, "gateway": <>, "subnet": <CIDR>},
                  "backend": {"interface": <parsed interface>, "gateway": <>, "subnet": <CIDR>},
                  "match": true|false,
                  "message": <ข้อความอธิบาย>
              },
              ...
          }
        }
    """
    comparison = {}

    # --- เปรียบเทียบ Switch ---
    switch_host = data.get("switchHost")
    frontend_switch_intf = data.get("switchInterface")
    expected_switch_vlans = set(cfg.get("vlanId") for cfg in data.get("vlanConfigs", []))
    
    # หา switch record จาก parsed_result โดยตรงตาม host และ interface
    switch_record = next((entry for entry in parsed_result 
                          if entry.get("type") == "switch" and 
                             entry.get("host") == switch_host and 
                             entry.get("interface") == frontend_switch_intf), None)
    
    if not switch_record:
        switch_result = {
            "frontend": {"interface": frontend_switch_intf, "vlans": list(expected_switch_vlans)},
            "backend": None,
            "match": False,
            "message": f"ไม่พบ switch record สำหรับ host {switch_host} และ interface {frontend_switch_intf}"
        }
    else:
        # แยก VLAN จาก string ที่อาจจะมี comma
        backend_vlans = set([v.strip() for v in switch_record.get("vlan_id", "").split(",") if v.strip()])
        if backend_vlans == expected_switch_vlans:
            msg = "Switch configuration ตรงกัน"
            match = True
        else:
            msg = f"Switch VLAN mismatch: คาดหวัง {expected_switch_vlans} แต่ได้ {backend_vlans}"
            match = False
        switch_result = {
            "frontend": {"interface": frontend_switch_intf, "vlans": list(expected_switch_vlans)},
            "backend": {"interface": switch_record.get("interface"), "vlans": list(backend_vlans)},
            "match": match,
            "message": msg
        }
    comparison["switch"] = switch_result

    # --- เปรียบเทียบ Router ---
    router_host = data.get("routerHost")
    frontend_router_intf = data.get("routerInterface")
    # คัด router records ที่ host ตรงกันและ interface เริ่มต้นด้วย routerInterface
    router_records = [entry for entry in parsed_result 
                      if entry.get("type") == "router" and 
                         entry.get("host") == router_host and 
                         entry.get("interface", "").startswith(frontend_router_intf)]
    
    router_comparison = {}
    for cfg in data.get("vlanConfigs", []):
        vlan_id = cfg.get("vlanId")
        expected_gateway = cfg.get("gateway")
        expected_subnet_cidr = str(cfg.get("subnet"))  # เช่น "24"
        # สำหรับ frontend interface ให้ต่อท้ายด้วย .vlan_id
        frontend_router_full_intf = f"{frontend_router_intf}.{vlan_id}"
        
        # ค้นหา router record ที่มี vlan_id ตรงกับ vlan_id นี้
        router_record = next((entry for entry in router_records if entry.get("vlan_id") == vlan_id), None)
        if not router_record:
            router_comparison[vlan_id] = {
                "frontend": {"interface": frontend_router_full_intf, "gateway": expected_gateway, "subnet": expected_subnet_cidr},
                "backend": None,
                "match": False,
                "message": f"ไม่พบ router record สำหรับ VLAN {vlan_id}"
            }
        else:
            actual_gateway = router_record.get("ip_address")
            backend_subnet_cidr = netmask_to_cidr(router_record.get("subnet", ""))
            backend_interface = router_record.get("interface")
            
            messages = []
            gateway_match = (expected_gateway == actual_gateway)
            subnet_match = (expected_subnet_cidr == backend_subnet_cidr)
            # ตรวจสอบ interface: สำหรับ frontend จะเป็น frontend_router_intf + '.' + vlan_id
            interface_match = (frontend_router_full_intf == backend_interface)
            
            if not gateway_match:
                messages.append(f"Gateway: คาดหวัง {expected_gateway} แต่ได้ {actual_gateway}")
            if not subnet_match:
                messages.append(f"Subnet: คาดหวัง {expected_subnet_cidr} แต่ได้ {backend_subnet_cidr}")
            if not interface_match:
                messages.append(f"Interface: คาดหวัง {frontend_router_full_intf} แต่ได้ {backend_interface}")
            
            overall_match = gateway_match and subnet_match and interface_match
            router_comparison[vlan_id] = {
                "frontend": {"interface": frontend_router_full_intf, "gateway": expected_gateway, "subnet": expected_subnet_cidr},
                "backend": {"interface": backend_interface, "gateway": actual_gateway, "subnet": backend_subnet_cidr},
                "match": overall_match,
                "message": "Router configuration ตรงกัน" if overall_match else "; ".join(messages)
            }
    comparison["router"] = router_comparison
    return comparison
