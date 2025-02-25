import ipaddress

def netmask_to_cidr(mask):
    if isinstance(mask, int):
        return mask
    try:
        parts = mask.split('.')
        if len(parts) != 4:
            return mask
        cidr = sum(bin(int(x)).count("1") for x in parts)
        return cidr
    except Exception:
        return mask

def compare_field(field_name, frontend_val, backend_val, diff):
    # For fields like 'cidr', normalize both values to integers for comparison.
    if field_name == "cidr":
        try:
            frontend_val = int(frontend_val)
        except Exception:
            pass
        try:
            backend_val = int(backend_val)
        except Exception:
            pass
    if not frontend_val:
        return True
    if frontend_val != backend_val:
        diff[field_name] = {"frontend": frontend_val, "backend": backend_val}
        return False
    return True

def compare_config_device(request_data, parsed_result):
    # Group the backend parsed result by host and command.
    grouped = {}
    for entry in parsed_result:
        host = entry.get("host")
        task = entry.get("task", "")
        if host not in grouped:
            grouped[host] = {}
        if task.startswith("Display VLAN details output for VLAN"):
            grouped[host].setdefault("vlan", {})["vlans"] = entry.get("vlans", [])
        elif task.startswith("Display interface details output for VLAN"):
            grouped[host].setdefault("vlan", {})["vlan_details"] = entry.get("vlan_details", {})
        elif task.startswith("Display running config output for interface"):
            grouped[host].setdefault("vlan", {})["interface_config"] = entry.get("interface_config", {})
        elif task.startswith("Display spanning-tree output for VLAN"):
            grouped[host]["bridge_priority"] = entry.get("spanning_tree", {})
        elif task.startswith("Display interface config output for"):
            grouped[host]["config_ip_router"] = entry.get("interface_config", {})
        # Merge loopback data from different tasks
        elif task.startswith("Display loopback interface output for"):
            grouped[host].setdefault("loopback", {}).update(entry.get("loopback", {}))
        elif task.startswith("Display loopback running OSPF output for"):
            grouped[host].setdefault("loopback", {}).update(entry.get("loopback", {}))
        elif task.startswith("Display loopback running RIPv2 output for"):
            grouped[host].setdefault("loopback", {}).update(entry.get("loopback", {}))
        elif task.startswith("Display static route output for prefix"):
            grouped[host]["static_route"] = entry.get("static_routes", [])
    
    comparisons = []
    
    for req in request_data:
        host = req.get("hostname")
        command = req.get("command")
        backend_entry = grouped.get(host, {}).get(command, {})
        match = True
        diff = {}
    
        if command == "vlan":
            frontend_vlan = req.get("vlanDataList", [{}])[0]
            backend_vlans = grouped.get(host, {}).get("vlan", {}).get("vlans") or []
            vlan_found = None
            for v in backend_vlans:
                if str(v.get("vlanId")) == str(frontend_vlan.get("vlanId")):
                    vlan_found = v
                    break
            if not vlan_found:
                diff["vlans"] = {"frontend": frontend_vlan, "backend": backend_vlans}
                match = False
            else:
                if not compare_field("vlanName", frontend_vlan.get("vlanName"), vlan_found.get("vlanName"), diff):
                    match = False
    
            frontend_vlan_details = {
                "vlanId": frontend_vlan.get("vlanId"),
                "ipaddress": frontend_vlan.get("ipAddress"),
                "cidr": frontend_vlan.get("cidr"),
            }
            backend_vlan_details = grouped.get(host, {}).get("vlan", {}).get("vlan_details", {})
            backend_vlan_details["ipaddress"] = backend_vlan_details.get("ipaddress") or ""
            backend_vlan_details["cidr"] = backend_vlan_details.get("cidr") or ""
            backend_vlan_details["vlanId"] = backend_vlan_details.get("vlanId") or (vlan_found.get("vlanId") if vlan_found else None)
            backend_cidr = backend_vlan_details.get("cidr")
            if isinstance(backend_cidr, str):
                backend_cidr = netmask_to_cidr(backend_cidr)
            backend_vlan_details["cidr"] = backend_cidr
            
            for field in ["vlanId", "ipaddress", "cidr"]:
                if not compare_field(field, frontend_vlan_details.get(field), backend_vlan_details.get(field), diff):
                    match = False
    
            frontend_intf = frontend_vlan.get("interfaces", [{}])[0]
            backend_intf = grouped.get(host, {}).get("vlan", {}).get("interface_config", {})
            for field in ["interface", "mode"]:
                if not compare_field(field, frontend_intf.get(field), backend_intf.get(field), diff):
                    match = False
    
            backend_entry = {
                "vlans": vlan_found,
                "vlan_details": backend_vlan_details,
                "interface_config": backend_intf,
            }
    
        elif command == "bridge_priority":
            frontend_bp = req.get("bridgePriority", {})
            backend_bp = grouped.get(host, {}).get("bridge_priority", {})
            try:
                front_priority = int(frontend_bp.get("priority"))
            except Exception:
                front_priority = frontend_bp.get("priority")
            try:
                back_priority = int(backend_bp.get("priority"))
            except Exception:
                back_priority = backend_bp.get("priority")
            if not compare_field("priority", front_priority, back_priority, diff):
                match = False
            
            bp_vlan = frontend_bp.get("vlan")
            additional_info = {}
            if "parsed_result" in req:
                for dev in req["parsed_result"]:
                    if dev.get("hostname") == host:
                        for v in dev.get("vlans", []):
                            if str(v.get("vlan_id")) == str(bp_vlan):
                                stp_detail = v.get("stp_detail", {})
                                additional_info = {"stp_interfaces": stp_detail.get("stp_interfaces", [])}
                                break
                        break
                    
            backend_entry = {"vlan": bp_vlan, "priority": backend_bp.get("priority")}
            if additional_info:
                backend_entry.update(additional_info)
            if not compare_field("vlan", bp_vlan, bp_vlan, diff):
                match = False
    
        elif command == "config_ip_router":
            frontend_cfg = req.get("configIp", {})
            backend_cfg = grouped.get(host, {}).get("config_ip_router", {})
            backend_cidr = backend_cfg.get("cidr") or backend_cfg.get("cidr".lower())
            if isinstance(backend_cidr, str):
                backend_cidr = netmask_to_cidr(backend_cidr)
            backend_cfg["cidr"] = backend_cidr
            for field in ["interface", "ipAddress", "cidr"]:
                backend_value = backend_cfg.get(field) or backend_cfg.get(field.lower())
                if not compare_field(field, frontend_cfg.get(field), backend_value, diff):
                    match = False
            backend_entry = backend_cfg
    
        elif command == "loopback":
            frontend_lb = req.get("loopbackData", {})
            backend_lb = grouped.get(host, {}).get("loopback", {})
            if not backend_lb.get("activateProtocol"):
                backend_lb["activateProtocol"] = "none"
            expected_intf = f"Loopback{frontend_lb.get('loopbackNumber')}"
            if not compare_field("interface", expected_intf, backend_lb.get("interface"), diff):
                match = False
            for field in ["ipAddress"]:
                if not compare_field(field, frontend_lb.get(field), backend_lb.get("ipaddress"), diff):
                    match = False
            for field in ["activateProtocol"]:
                if not compare_field(field, frontend_lb.get(field), backend_lb.get("activateProtocol"), diff):
                    match = False
            backend_entry = backend_lb
    
        elif command == "static_route":
            frontend_sr = req.get("staticRouteData", {})
            backend_routes = grouped.get(host, {}).get("static_route", [])
    
            # Calculate the network from the frontend prefix and cidr.
            try:
                frontend_network = ipaddress.ip_network(
                    f"{frontend_sr.get('prefix')}/{frontend_sr.get('cidr')}",
                    strict=False
                )
            except Exception:
                frontend_network = None
    
            route_found = None
            # Use the calculated network for prefix comparison.
            for route in backend_routes:
                try:
                    backend_network = ipaddress.ip_network(
                        f"{route.get('prefix')}/{route.get('cidr')}",
                        strict=False
                    )
                except Exception:
                    backend_network = None
                if frontend_network and backend_network and frontend_network == backend_network:
                    route_found = route
                    # Update the route's prefix to the calculated network address.
                    try:
                        computed_network = ipaddress.ip_network(
                            f"{route.get('prefix')}/{route.get('cidr')}",
                            strict=False
                        )
                        route_found["prefix"] = str(computed_network.network_address)
                    except Exception:
                        pass
                    break
            
            if not route_found:
                diff["static_route"] = {"frontend": frontend_sr, "backend": backend_routes}
                match = False
            else:
                for field in ["cidr", "nextHop"]:
                    if field == "nextHop":
                        backend_field_val = route_found.get("nextHop") or route_found.get("nexthop")
                    else:
                        backend_field_val = route_found.get(field)
                    if not compare_field(field, frontend_sr.get(field), backend_field_val, diff):
                        match = False
                backend_entry = route_found
    
        comparisons.append({
            "frontend": req,
            "backend": {"hostname": host, **backend_entry},
            "match": match,
            "diff": diff
        })
    
    return comparisons