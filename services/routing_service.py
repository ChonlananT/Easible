import ipaddress
from collections import defaultdict
from services.validators.link_validator import LinkValidator

class RoutingService:
    AD_VALUES = {
        "Connected": 0,
        "Static": 1,
        "OSPF": 110,
        "OSPF_IA": 110,
        "RIPv2": 120,
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
        """
        1) Validate all links.
        2) Build IP->Hostname mapping.
        3) Add connected routes for each link, tagging them with
           'connected_protocol' = link's protocol.
        4) Iteratively propagate routes until convergence or max_iterations.
        """
        # 1) Validate links
        for link in links:
            errors = LinkValidator.validate_link(link)
            if errors:
                raise ValueError(", ".join(errors))

        # 2) Populate IP->Hostname
        for link in links:
            self.ip_to_hostname[link["ip1"]] = link["hostname1"]
            self.ip_to_hostname[link["ip2"]] = link["hostname2"]

        # 3) Add connected routes
        for link in links:
            self._process_directly_connected(link)

        # 4) Iterative propagation
        max_iterations = 100
        for iteration in range(max_iterations):
            previous = self._shallow_copy_routing_tables()

            for link in links:
                self._propagate_routes(link)

            if self._routing_tables_equal(previous, self.routing_tables):
                break
        else:
            print("Warning: Maximum iterations reached. Possible routing loop.")

        return self.routing_tables

    def _shallow_copy_routing_tables(self):
        """Create a shallow copy of the routing tables (lists of dicts)."""
        return {h: list(routes) for h, routes in self.routing_tables.items()}

    def _routing_tables_equal(self, table1, table2):
        """Compare two routing tables for equality."""
        if set(table1.keys()) != set(table2.keys()):
            return False

        for hostname in table1:
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
        For a link:
          - Add 'Connected' routes to both endpoints.
          - Store the link's protocol as 'connected_protocol'
            so we know which protocol domain it belongs to.
        """
        host1, host2 = link["hostname1"], link["hostname2"]
        ip1, ip2 = link["ip1"], link["ip2"]
        interface1, interface2 = link["interface1"], link["interface2"]
        subnet = int(link["subnet"])

        # Normalize the link's protocol
        link_proto = link["protocol"].upper()
        if link_proto in {"RIP", "RIPV2"}:
            link_proto = "RIPv2"

        # Swap IPs/interfaces if ip1 doesn't actually belong to hostname1
        if self.ip_to_hostname[ip1] != host1:
            ip1, ip2 = ip2, ip1
            interface1, interface2 = interface2, interface1

        network = ipaddress.IPv4Network(f"{ip1}/{subnet}", strict=False).network_address
        subnet_cidr = f"{network}/{subnet}"
        link_name = f"{host1}-{host2}"

        # Add 'Connected' route for host1 (tag with link_proto)
        self._add_or_replace_route(host1, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface1,
            "protocol": "Connected",
            "connected_protocol": link_proto,  # <--- tag the link's protocol
            "metric": 0,
            "nexthop": "directly",
            "link": link_name
        })

        # Add 'Connected' route for host2 (tag with link_proto)
        self._add_or_replace_route(host2, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface2,
            "protocol": "Connected",
            "connected_protocol": link_proto,
            "metric": 0,
            "nexthop": "directly",
            "link": link_name
        })

        # Track subnets
        self.directly_connected_subnets[host1].add(subnet_cidr)
        self.directly_connected_subnets[host2].add(subnet_cidr)

        # Store adjacency info
        self.interfaces[host1][host2] = {
            "interface": interface1,
            "peer_ip": ip2
        }
        self.interfaces[host2][host1] = {
            "interface": interface2,
            "peer_ip": ip1
        }

    def _add_or_replace_route(self, hostname, new_route):
        """
        Adds a route, respecting:
          - Connected routes never get overwritten by non-connected.
          - Lower administrative distance wins.
          - For same AD, lower metric wins; or if same metric and protocol
            supports ECMP, add parallel.
        """
        existing_routes = self.routing_tables[hostname]
        new_ad = self.AD_VALUES.get(new_route["protocol"], 255)

        # 1) If exact route (same subnet/proto/metric/etc) already exists, skip
        for route in existing_routes:
            if (route["subnet"] == new_route["subnet"] and
                route["protocol"] == new_route["protocol"] and
                route.get("connected_protocol") == new_route.get("connected_protocol") and
                route["metric"] == new_route["metric"] and
                route.get("nexthop") == new_route.get("nexthop") and
                route.get("outgoing_interface") == new_route.get("outgoing_interface") and
                route.get("link") == new_route.get("link")):
                return

        # 2) If it's Connected, just add (do not overwrite existing connected)
        if new_route["protocol"] == "Connected":
            self.routing_tables[hostname].append(new_route)
            return

        # 3) For non-connected, see if there's an existing route to that subnet
        same_subnet_routes = [r for r in existing_routes if r["subnet"] == new_route["subnet"]]
        if same_subnet_routes:
            best_ad = min(self.AD_VALUES.get(r["protocol"], 255) for r in same_subnet_routes)
        else:
            best_ad = None

        # 4) If no existing route or our AD is better, replace
        if best_ad is None or new_ad < best_ad:
            self.routing_tables[hostname] = [
                r for r in existing_routes if r["subnet"] != new_route["subnet"]
            ]
            self.routing_tables[hostname].append(new_route)
            return

        # 5) If our AD == best_ad, compare metrics
        if new_ad == best_ad:
            existing_best_metric = min(
                r["metric"] for r in same_subnet_routes
                if self.AD_VALUES.get(r["protocol"], 255) == best_ad
            )
            # If new metric is better, replace all
            if new_route["metric"] < existing_best_metric:
                self.routing_tables[hostname] = [
                    r for r in existing_routes if r["subnet"] != new_route["subnet"]
                ]
                self.routing_tables[hostname].append(new_route)
            # If same metric and protocol supports ECMP, add parallel
            elif (new_route["metric"] == existing_best_metric and
                  new_route["protocol"] in {"OSPF", "RIPv2"}):
                self.routing_tables[hostname].append(new_route)

    def _propagate_routes(self, link):
        """
        Propagate routes only if the link is OSPF or RIP/RIPv2.
        """
        link_proto = link["protocol"].upper()
        if link_proto in {"RIP", "RIPV2"}:
            link_proto = "RIPv2"

        if link_proto in {"OSPF", "RIPv2"}:
            # Propagate in both directions
            self._propagate_from_to(link["hostname1"], link["hostname2"], link_proto)
            self._propagate_from_to(link["hostname2"], link["hostname1"], link_proto)
        # If not OSPF or RIP, no propagation

    def _propagate_from_to(self, from_host, to_host, link_protocol):
        """
        Propagate routes from `from_host` to `to_host` ONLY if:
          1) route["protocol"] == link_protocol (same protocol), OR
          2) route["protocol"] == "Connected" AND route["connected_protocol"] == link_protocol.

        That ensures:
          - No cross-protocol leakage (OSPF stays in OSPF, RIP stays in RIP).
          - Multiple OSPF links share each other's routes (including connected).
          - Multiple RIP links share each other's routes (including connected).
          - 'Connected' subnets are only injected into the protocol domain they
            are physically tied to via 'connected_protocol'.
        """
        for route in self.routing_tables[from_host]:
            original_proto = route["protocol"]

            # Condition 1: route is same protocol already (e.g., OSPF on an OSPF link)
            if original_proto == link_protocol:
                new_proto = link_protocol

            # Condition 2: route is physically connected, check if it matches link_protocol
            elif (original_proto == "Connected" and 
                  route.get("connected_protocol") == link_protocol):
                new_proto = link_protocol

            else:
                # Different protocol => skip
                continue

            subnet = route["subnet"]
            # Skip if to_host is directly connected to that subnet
            if subnet in self.directly_connected_subnets[to_host]:
                continue

            to_host_if_data = self.interfaces[to_host].get(from_host)
            if not to_host_if_data:
                continue  # no adjacency or incomplete data

            new_metric = route["metric"] + 1
            propagated_route = {
                "subnet": subnet,
                "outgoing_interface": to_host_if_data["interface"],
                "protocol": new_proto,  # either link_protocol or same
                "metric": new_metric,
                "nexthop": to_host_if_data["peer_ip"],
                "link": route["link"],
            }
            # If it's originally Connected, we keep 'connected_protocol' to track it
            if original_proto == "Connected":
                propagated_route["connected_protocol"] = route["connected_protocol"]

            self._add_or_replace_route(to_host, propagated_route)
