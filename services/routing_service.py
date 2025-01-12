import ipaddress
from collections import defaultdict
from services.validators.link_validator import LinkValidator
import copy

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
        self.interfaces = defaultdict(dict)  # {hostname: {neighbor_hostname: interface_name}}
        self.ip_to_hostname = {}  # {ip_address: hostname}

    def process_links(self, links):
        """
        Validate links, process directly connected routes, and iteratively propagate routes.

        Args:
            links (list): List of link dictionaries.

        Returns:
            dict: Final routing tables for all routers.

        Raises:
            ValueError: If validation fails for any link.
        """
        # Validate all links
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

        # Iteratively propagate routes until no new routes are added
        routes_changed = True
        while routes_changed:
            routes_changed = False
            previous_routing_tables = copy.deepcopy(self.routing_tables)

            for link in links:
                self._propagate_routes(link)

            if previous_routing_tables != self.routing_tables:
                routes_changed = True

        return self.routing_tables

    def _process_directly_connected(self, link):
        """
        Add directly connected routes for both endpoints of the link.

        Args:
            link (dict): A single link dictionary.
        """
        host1, host2 = link["hostname1"], link["hostname2"]
        ip1, ip2, subnet = link["ip1"], link["ip2"], int(link["subnet"])
        interface1, interface2 = link["interface1"], link["interface2"]

        # Compute the network address and CIDR format
        network = ipaddress.IPv4Network(f"{ip1}/{subnet}", strict=False).network_address
        subnet_cidr = f"{network}/{subnet}"

        # Add connected routes to routing tables
        self._add_or_replace_route(host1, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface1,
            "protocol": "Connected",
            "destination": host2,
            "metric": 0
        })
        self._add_or_replace_route(host2, {
            "subnet": subnet_cidr,
            "outgoing_interface": interface2,
            "protocol": "Connected",
            "destination": host1,
            "metric": 0
        })

        # Track directly connected subnets and interfaces
        self.directly_connected_subnets[host1].add(subnet_cidr)
        self.directly_connected_subnets[host2].add(subnet_cidr)
        self.interfaces[host1][host2] = interface1
        self.interfaces[host2][host1] = interface2

    def _add_or_replace_route(self, hostname, new_route):
        """
        Add a new route to the routing table or replace an existing route
        based on Administrative Distance (AD) and metric.

        Args:
            hostname (str): Hostname of the router.
            new_route (dict): The route to be added.
        """
        existing_routes = self.routing_tables[hostname]
        for idx, route in enumerate(existing_routes):
            if route["subnet"] == new_route["subnet"]:
                current_ad = self.AD_VALUES[route["protocol"]]
                new_ad = self.AD_VALUES[new_route["protocol"]]

                # Replace the route if the new one has a lower AD or equal AD but better metric
                if new_ad < current_ad or (new_ad == current_ad and new_route["metric"] < route["metric"]):
                    existing_routes[idx] = new_route
                return  # Don't add duplicate routes

        # Add the new route if no existing one was found
        existing_routes.append(new_route)

    def _propagate_routes(self, link):
        """
        Propagate routes between two connected hosts.

        Args:
            link (dict): A single link dictionary.
        """
        protocol = link["protocol"].upper()
        if protocol == "OSPF":
            self._propagate_ospf(link)
        elif protocol == "RIP":
            self._propagate_rip(link)

    def _propagate_ospf(self, link):
        """
        Propagate OSPF routes, including intra-area and inter-area (O IA).

        Args:
            link (dict): A single link dictionary.
        """
        host1, host2 = link["hostname1"], link["hostname2"]
        area1 = link.get("area", 0)  # Default to area 0 if not specified
        area2 = link.get("area", 0)

        # Intra-area propagation
        if area1 == area2:
            self._propagate_from_to(host1, host2, "OSPF", area1)
            self._propagate_from_to(host2, host1, "OSPF", area2)
        # Inter-area propagation (O IA)
        else:
            self._propagate_between_areas(host1, host2, "OSPF_IA", area1, area2)
            self._propagate_between_areas(host2, host1, "OSPF_IA", area2, area1)

    def _propagate_rip(self, link):
        """
        Propagate RIP routes between two connected hosts.

        Args:
            link (dict): A single link dictionary.
        """
        host1, host2 = link["hostname1"], link["hostname2"]

        # RIP does not use areas
        self._propagate_from_to(host1, host2, "RIP")
        self._propagate_from_to(host2, host1, "RIP")

    def _propagate_from_to(self, from_host, to_host, protocol, area=None):
        """
        Propagate routes from one host to another.

        Args:
            from_host (str): The source hostname.
            to_host (str): The destination hostname.
            protocol (str): The routing protocol used for propagation.
            area (int): The OSPF area ID (None for non-OSPF).
        """
        for route in self.routing_tables[from_host]:
            subnet = route["subnet"]

            # Skip directly connected subnets
            if subnet in self.directly_connected_subnets[to_host]:
                continue

            # Determine outgoing interface
            outgoing_interface = self.interfaces[to_host].get(from_host)
            if not outgoing_interface:
                continue

            # Compute the updated metric
            new_metric = route["metric"] + 1

            # Check if this route is better than existing routes
            existing_route = next(
                (r for r in self.routing_tables[to_host] if r["subnet"] == subnet),
                None
            )
            if existing_route:
                current_ad = self.AD_VALUES[existing_route["protocol"]]
                new_ad = self.AD_VALUES[protocol]

                # Replace the route only if the new route has a better AD or a lower metric
                if new_ad < current_ad or (new_ad == current_ad and new_metric < existing_route["metric"]):
                    self.routing_tables[to_host].remove(existing_route)
                else:
                    # Skip adding the route if it's not better
                    continue

            # Add or replace the route
            self._add_or_replace_route(to_host, {
                "subnet": subnet,
                "outgoing_interface": outgoing_interface,
                "protocol": protocol,
                "area": area if protocol.startswith("OSPF") else None,
                "destination": route["destination"],
                "metric": new_metric
            })

    def _propagate_between_areas(self, from_host, to_host, protocol, from_area, to_area):
        """
        Propagate inter-area routes (O IA) across different OSPF areas.

        Args:
            from_host (str): The source hostname (ABR).
            to_host (str): The destination hostname.
            protocol (str): The routing protocol (OSPF_IA).
            from_area (int): The OSPF area ID of the from_host.
            to_area (int): The OSPF area ID of the to_host.
        """
        for route in self.routing_tables[from_host]:
            subnet = route["subnet"]

            # Skip directly connected subnets
            if subnet in self.directly_connected_subnets[to_host]:
                continue

            # Skip if the route is already propagated as OSPF_IA
            if any(r["subnet"] == subnet and r["protocol"] == "OSPF_IA" for r in self.routing_tables[to_host]):
                continue

            # Add inter-area route
            outgoing_interface = self.interfaces[to_host].get(from_host)
            self._add_or_replace_route(to_host, {
                "subnet": subnet,
                "outgoing_interface": outgoing_interface,
                "protocol": protocol,
                "area": from_area,
                "destination": route["destination"],
                "metric": route["metric"] + 1
            })
