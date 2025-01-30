import ipaddress
from collections import defaultdict
from services.validators.link_validator import LinkValidator


class RoutingService:
    AD_VALUES = {
        "Connected": 0,
        "Static": 1,
        "OSPF": 110,
        "OSPF_IA": 110,
        "RIP": 120,
    }

    def __init__(self):
        self.routing_tables = defaultdict(list)  # {hostname: [route_entries]}
        self.directly_connected_subnets = defaultdict(set)  # {hostname: set(subnets)}
        self.interfaces = defaultdict(dict)  # {hostname: {neighbor_hostname: {interface, peer_ip}}}
        self.ip_to_hostname = {}  # {ip_address: hostname}

    def process_links(self, links):
        """Validate links, process directly connected routes, and iteratively propagate routes."""
        for link in links:
            errors = LinkValidator.validate_link(link)
            if errors:
                raise ValueError(
                    f"Validation errors for link {link.get('hostname1')} -> {link.get('hostname2')}:\n" +
                    ", ".join(errors)
                )

        # Populate IP to Hostname mapping
        for link in links:
            self.ip_to_hostname[link["ip1"]] = link["hostname1"]
            self.ip_to_hostname[link["ip2"]] = link["hostname2"]

        # Add directly connected routes
        for link in links:
            self._process_directly_connected(link)

        # Iteratively propagate routes
        max_iterations = 100  
        iteration = 0

        while iteration < max_iterations:
            previous_routing_tables = self._shallow_copy_routing_tables()

            for link in links:
                self._propagate_routes(link)

            if self._routing_tables_equal(previous_routing_tables, self.routing_tables):
                break  # Convergence achieved

            iteration += 1

        if iteration >= max_iterations:
            print("Warning: Maximum iterations reached. Possible infinite loop.")

        return self.routing_tables

    def _shallow_copy_routing_tables(self):
        return {hostname: list(routes) for hostname, routes in self.routing_tables.items()}

    def _routing_tables_equal(self, table1, table2):
        if set(table1.keys()) != set(table2.keys()):
            return False
        for hostname in table1:
            routes1 = sorted(table1[hostname], key=lambda r: (r["subnet"], r["protocol"], r.get("metric", 0), r.get("nexthop", ""), r.get("outgoing_interface", "")))
            routes2 = sorted(table2[hostname], key=lambda r: (r["subnet"], r["protocol"], r.get("metric", 0), r.get("nexthop", ""), r.get("outgoing_interface", "")))
            if routes1 != routes2:
                return False
        return True

    def _process_directly_connected(self, link):
        """Add directly connected routes for both endpoints of the link."""
        host1, host2 = link["hostname1"], link["hostname2"]
        ip1, ip2, subnet = link["ip1"], link["ip2"], int(link["subnet"])
        interface1, interface2 = link["interface1"], link["interface2"]

        network = ipaddress.IPv4Network(f"{ip1}/{subnet}", strict=False).network_address
        subnet_cidr = f"{network}/{subnet}"

        print(f"Adding directly connected route: {host1} <-> {host2} ({subnet_cidr})")

        self._add_or_replace_route(host1, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface1,
            "protocol": "Connected",
            "metric": 0,
            "nexthop": "directly",
            "link": f"{host1}-{host2}"
        })
        self._add_or_replace_route(host2, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface2,
            "protocol": "Connected",
            "metric": 0,
            "nexthop": "directly",
            "link": f"{host2}-{host1}"
        })

        self.directly_connected_subnets[host1].add(subnet_cidr)
        self.directly_connected_subnets[host2].add(subnet_cidr)
        self.interfaces[host1][host2] = {"interface": interface1, "peer_ip": ip2}
        self.interfaces[host2][host1] = {"interface": interface2, "peer_ip": ip1}

    def _add_or_replace_route(self, hostname, new_route):
        """Add a route to the routing table, ensuring connected routes are never overwritten."""
        existing_routes = self.routing_tables[hostname]
        new_ad = self.AD_VALUES.get(new_route["protocol"], 255)  

        # Prevent duplicate exact routes
        for route in existing_routes:
            if (
                route["subnet"] == new_route["subnet"]
                and route["protocol"] == new_route["protocol"]
                and route["metric"] == new_route["metric"]
                and route.get("nexthop", "") == new_route.get("nexthop", "")
                and route.get("outgoing_interface", "") == new_route.get("outgoing_interface", "")
            ):
                return  

        if new_route["protocol"] == "Connected":
            self.routing_tables[hostname].append(new_route)
            return

        is_ecmp_allowed = new_route["protocol"] in {"OSPF", "RIP"}
        same_subnet_routes = [r for r in existing_routes if r["subnet"] == new_route["subnet"]]

        if same_subnet_routes:
            best_ad = min(self.AD_VALUES.get(r["protocol"], 255) for r in same_subnet_routes)
        else:
            best_ad = None

        if best_ad is None or new_ad < best_ad:
            self.routing_tables[hostname] = [r for r in existing_routes if r["subnet"] != new_route["subnet"]]
            self.routing_tables[hostname].append(new_route)
        elif new_ad == best_ad:
            existing_best_metric = min(r["metric"] for r in same_subnet_routes if self.AD_VALUES.get(r["protocol"], 255) == best_ad)

            if new_route["metric"] < existing_best_metric:
                self.routing_tables[hostname] = [r for r in existing_routes if r["subnet"] != new_route["subnet"]]
                self.routing_tables[hostname].append(new_route)
            elif new_route["metric"] == existing_best_metric and is_ecmp_allowed:
                self.routing_tables[hostname].append(new_route)

    def _propagate_routes(self, link):
        """Propagate routes between connected routers."""
        protocol = link["protocol"].upper()
        if protocol == "OSPF":
            self._propagate_from_to(link["hostname1"], link["hostname2"], "OSPF")
            self._propagate_from_to(link["hostname2"], link["hostname1"], "OSPF")
        elif protocol == "RIP":
            self._propagate_from_to(link["hostname1"], link["hostname2"], "RIP")
            self._propagate_from_to(link["hostname2"], link["hostname1"], "RIP")

    def _propagate_from_to(self, from_host, to_host, protocol):
        """Propagate routes from one host to another."""
        for route in self.routing_tables[from_host]:
            subnet = route["subnet"]
            if subnet in self.directly_connected_subnets[to_host]:
                continue  

            interface_details = self.interfaces[from_host].get(to_host)
            if not interface_details:
                continue  

            outgoing_interface = interface_details["interface"]
            nexthop = interface_details["peer_ip"]
            new_metric = route["metric"] + 1  

            propagated_route = {
                "subnet": subnet,
                "outgoing_interface": outgoing_interface,
                "protocol": protocol,
                "metric": new_metric,
                "nexthop": nexthop,
                "link": route.get("link", f"{from_host}-{to_host}")
            }

            self._add_or_replace_route(to_host, propagated_route)
