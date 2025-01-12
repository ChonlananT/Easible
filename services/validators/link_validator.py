from ipaddress import ip_address, ip_network
from services.validators.ip_validator import IPValidator
from services.validators.subnet_validator import SubnetValidator

class LinkValidator:
    ALLOWED_PROTOCOLS = {"OSPF", "RIP", "Static", "None"}  # Define allowed protocols

    @staticmethod
    def check_same_subnet(ip1, ip2, subnet):
        """
        Check if two IP addresses belong to the same subnet.

        Args:
            ip1 (str): First IP address.
            ip2 (str): Second IP address.
            subnet (str): Subnet prefix length (e.g., '24').

        Returns:
            bool: True if both IPs belong to the same subnet, False otherwise.
        """
        try:
            netmask = SubnetValidator.subnet_to_mask(subnet)
            network = ip_network(f"{ip1}/{netmask}", strict=False)
            return ip_address(ip2) in network
        except ValueError:
            return False

    @staticmethod
    def validate_link(link):
        """
        Validate a single link configuration.

        Args:
            link (dict): Link configuration containing IPs, subnet, protocol, etc.

        Returns:
            list: List of validation errors. Empty if no errors.
        """
        errors = []

        # Extract data from the link
        ip1 = link.get("ip1")
        ip2 = link.get("ip2")
        subnet = link.get("subnet")
        protocol = link.get("protocol")

        # Validate IP addresses
        if not IPValidator.validate_ip(ip1):
            errors.append(f"Invalid IP address: {ip1}")
        if not IPValidator.validate_ip(ip2):
            errors.append(f"Invalid IP address: {ip2}")

        # Validate subnet
        if not SubnetValidator.validate_subnet(subnet):
            errors.append(f"Invalid subnet: {subnet}")

        # Validate protocol
        if protocol not in LinkValidator.ALLOWED_PROTOCOLS:
            errors.append(
                f"Invalid routing protocol: {protocol}. "
                f"Allowed protocols are {', '.join(LinkValidator.ALLOWED_PROTOCOLS)}"
            )

        # Check if IPs are in the same subnet
        if not errors and not LinkValidator.check_same_subnet(ip1, ip2, subnet):
            errors.append(f"IPs {ip1} and {ip2} are not in the same subnet /{subnet}")

        return errors
