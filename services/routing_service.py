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
        # {hostname: [route_entries]}
        self.routing_tables = defaultdict(list)
        # {hostname: set(subnets)}
        self.directly_connected_subnets = defaultdict(set)
        # {hostname: {neighbor_hostname: {"interface": <local_if>, "peer_ip": <neighbor_ip>}}}
        self.interfaces = defaultdict(dict)
        # {ip_address: hostname}
        self.ip_to_hostname = {}

    def process_links(self, links):
        """Validate links, process directly connected routes, and iteratively propagate routes."""
        # 1. Validate all links
        for link in links:
            errors = LinkValidator.validate_link(link)
            if errors:
                raise ValueError(
                    f"Validation errors for link {link.get('hostname1')} -> {link.get('hostname2')}:\n"
                    + ", ".join(errors)
                )

        # 2. Populate IP -> Hostname mapping
        for link in links:
            self.ip_to_hostname[link["ip1"]] = link["hostname1"]
            self.ip_to_hostname[link["ip2"]] = link["hostname2"]

        # 3. Add directly connected routes
        for link in links:
            self._process_directly_connected(link)

        # 4. Iteratively propagate routes until convergence or max_iterations
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
            print("Warning: Maximum iterations reached. Possible routing loop.")

        return self.routing_tables

    def _shallow_copy_routing_tables(self):
        """Create a shallow copy of the routing tables (lists of dicts)."""
        return {hostname: list(routes) for hostname, routes in self.routing_tables.items()}

    def _routing_tables_equal(self, table1, table2):
        """Compare two routing tables for equality."""
        if set(table1.keys()) != set(table2.keys()):
            return False

        for hostname in table1:
            # Sort routes for deterministic comparison
            sort_key = lambda r: (
                r["subnet"],
                r["protocol"],
                r.get("metric", 0),
                r.get("nexthop", ""),
                r.get("outgoing_interface", "")
            )
            routes1 = sorted(table1[hostname], key=sort_key)
            routes2 = sorted(table2[hostname], key=sort_key)
            if routes1 != routes2:
                return False

        return True

    def _process_directly_connected(self, link):
        """
        Add directly connected routes for both endpoints of the link.
        Ensures ip1/interface1 truly map to hostname1, ip2/interface2 map to hostname2.
        """
        host1, host2 = link["hostname1"], link["hostname2"]
        ip1, ip2 = link["ip1"], link["ip2"]
        interface1, interface2 = link["interface1"], link["interface2"]
        subnet = int(link["subnet"])

        # --- Swap IPs/interfaces if ip1 doesn't actually belong to hostname1 ---
        if self.ip_to_hostname[ip1] != host1:
            ip1, ip2 = ip2, ip1
            interface1, interface2 = interface2, interface1

        # Now ip1 belongs to host1, and ip2 belongs to host2
        network = ipaddress.IPv4Network(f"{ip1}/{subnet}", strict=False).network_address
        subnet_cidr = f"{network}/{subnet}"

        # Always keep the link name in the same order: host1-host2
        link_name = f"{host1}-{host2}"

        # Add the connected route for host1
        self._add_or_replace_route(host1, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface1,
            "protocol": "Connected",
            "metric": 0,
            "nexthop": "directly",
            "link": link_name
        })

        # Add the connected route for host2
        self._add_or_replace_route(host2, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface2,
            "protocol": "Connected",
            "metric": 0,
            "nexthop": "directly",
            "link": link_name
        })

        # Track subnets and interfaces
        self.directly_connected_subnets[host1].add(subnet_cidr)
        self.directly_connected_subnets[host2].add(subnet_cidr)

        # For host1, the neighbor is host2. ip1 is host1's IP, ip2 is host2's IP
        self.interfaces[host1][host2] = {
            "interface": interface1,  # local interface on host1
            "peer_ip": ip2           # IP of the neighbor (host2)
        }

        # For host2, the neighbor is host1
        self.interfaces[host2][host1] = {
            "interface": interface2,  # local interface on host2
            "peer_ip": ip1           # IP of the neighbor (host1)
        }

    def _add_or_replace_route(self, hostname, new_route):
        """
        Add a route to the routing table, respecting:
          - Connected routes have highest precedence (never overwrite them).
          - Administrative distance decides tie-break among protocols.
          - For same AD, compare metrics. If metric is lower, replace. If equal
            and the protocol supports ECMP (OSPF/RIP), add as a second route.
        """
        existing_routes = self.routing_tables[hostname]
        new_ad = self.AD_VALUES.get(new_route["protocol"], 255)

        # 1. If the exact route (subnet, protocol, metric, nexthop, interface, link) already exists, skip
        for route in existing_routes:
            if (
                route["subnet"] == new_route["subnet"]
                and route["protocol"] == new_route["protocol"]
                and route["metric"] == new_route["metric"]
                and route.get("nexthop") == new_route.get("nexthop")
                and route.get("outgoing_interface") == new_route.get("outgoing_interface")
                and route.get("link") == new_route.get("link")
            ):
                return

        # 2. If it's a Connected route, add it outright (never overwrite Connected)
        if new_route["protocol"] == "Connected":
            self.routing_tables[hostname].append(new_route)
            return

        # 3. For non-connected routes, check if we already have routes to the same subnet
        same_subnet_routes = [r for r in existing_routes if r["subnet"] == new_route["subnet"]]
        is_ecmp_allowed = new_route["protocol"] in {"OSPF", "RIP"}

        if same_subnet_routes:
            # Find the best (lowest) AD among them
            best_ad = min(self.AD_VALUES.get(r["protocol"], 255) for r in same_subnet_routes)
        else:
            best_ad = None

        # 4. If there's no existing route or our AD is better, replace all to that subnet
        if best_ad is None or new_ad < best_ad:
            self.routing_tables[hostname] = [
                r for r in existing_routes if r["subnet"] != new_route["subnet"]
            ]
            self.routing_tables[hostname].append(new_route)

        # 5. If our AD matches the best AD, we compare metrics for tie-break
        elif new_ad == best_ad:
            existing_best_metric = min(
                r["metric"]
                for r in same_subnet_routes
                if self.AD_VALUES.get(r["protocol"], 255) == best_ad
            )

            if new_route["metric"] < existing_best_metric:
                # We have found a strictly better route
                self.routing_tables[hostname] = [
                    r for r in existing_routes if r["subnet"] != new_route["subnet"]
                ]
                self.routing_tables[hostname].append(new_route)
            elif new_route["metric"] == existing_best_metric and is_ecmp_allowed:
                # ECMP scenario: same metric, same AD, add in parallel
                self.routing_tables[hostname].append(new_route)

    def _propagate_routes(self, link):
        """Propagate routes if the link protocol is OSPF or RIP."""
        protocol = link["protocol"].upper()
        if protocol == "OSPF":
            self._propagate_from_to(link["hostname1"], link["hostname2"], "OSPF")
            self._propagate_from_to(link["hostname2"], link["hostname1"], "OSPF")
        elif protocol == "RIP":
            self._propagate_from_to(link["hostname1"], link["hostname2"], "RIP")
            self._propagate_from_to(link["hostname2"], link["hostname1"], "RIP")

    def _propagate_from_to(self, from_host, to_host, protocol):
        """
        Propagate routes from `from_host` to `to_host`.
        In to_host’s table:
          - outgoing_interface = to_host’s local interface (for reaching from_host)
          - nexthop           = from_host’s IP (the “peer IP” from to_host’s perspective)
          - link              = keep the same link label as the original route 
                               (so it doesn't flip to 'r2-r1').
        """
        for route in self.routing_tables[from_host]:
            subnet = route["subnet"]

            # Skip if to_host already sees this as a directly connected subnet
            if subnet in self.directly_connected_subnets[to_host]:
                continue

            # Retrieve how to_host reaches from_host (local interface, from_host's IP)
            to_host_if_data = self.interfaces[to_host].get(from_host)
            if not to_host_if_data:
                continue  # no direct adjacency or missing data

            new_metric = route["metric"] + 1

            # Keep the original link name to avoid flipping (r1-r2 / r2-r1)
            propagated_route = {
                "subnet": subnet,
                "outgoing_interface": to_host_if_data["interface"],  # local interface of to_host
                "protocol": protocol,
                "metric": new_metric,
                "nexthop": to_host_if_data["peer_ip"],               # from_host's IP
                "link": route["link"],                               # keep the same link name
            }

            # Finally, add or replace the route in to_host’s routing table
            self._add_or_replace_route(to_host, propagated_route)
