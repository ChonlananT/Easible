import ipaddress

class LinkValidator:
    @staticmethod
    def validate_link(link):
        errors = []

        # Extract fields
        ip1_str = link.get("ip1")
        ip2_str = link.get("ip2")
        subnet_str = link.get("subnet")

        # Basic presence checks (ensure fields aren't missing or empty)
        if not ip1_str:
            errors.append("Missing ip1")
        if not ip2_str:
            errors.append("Missing ip2")
        if not subnet_str:
            errors.append("Missing subnet")

        # Proceed only if required fields are provided
        if ip1_str and ip2_str and subnet_str:
            # 1) Check if ip1 and ip2 are identical.
            if ip1_str == ip2_str:
                errors.append("Host1 and Host2 cannot share the same IP address.")

            # 2) Validate both IPs and create networks.
            try:
                ip_obj1 = ipaddress.ip_address(ip1_str)
                # Create network with strict=False to allow non-network addresses.
                net1 = ipaddress.ip_network(f"{ip1_str}/{subnet_str}", strict=False)
            except ValueError:
                errors.append(f"Invalid IP or Subnet for ip1: {ip1_str}/{subnet_str}")
                net1 = None

            try:
                ip_obj2 = ipaddress.ip_address(ip2_str)
                net2 = ipaddress.ip_network(f"{ip2_str}/{subnet_str}", strict=False)
            except ValueError:
                errors.append(f"Invalid IP or Subnet for ip2: {ip2_str}/{subnet_str}")
                net2 = None

            # Continue only if both networks were successfully created.
            if net1 and net2:
                # 3) Check if the given IP is being used as a network or broadcast address.
                if ip_obj1 == net1.network_address:
                    errors.append(f"IP1 ({ip1_str}) is the network address.")
                if ip_obj1 == net1.broadcast_address and net1.num_addresses > 2:
                    errors.append(f"IP1 ({ip1_str}) is the broadcast address.")
                if ip_obj2 == net2.network_address:
                    errors.append(f"IP2 ({ip2_str}) is the network address.")
                if ip_obj2 == net2.broadcast_address and net2.num_addresses > 2:
                    errors.append(f"IP2 ({ip2_str}) is the broadcast address.")

                # 4) Check if both IPs are in the same subnet.
                # Compare the network addresses and netmasks of the two networks.
                if net1.network_address != net2.network_address or net1.netmask != net2.netmask:
                    errors.append(
                        f"IP1 ({ip1_str}/{subnet_str}) and IP2 ({ip2_str}/{subnet_str}) are not in the same subnet."
                    )

        return errors
