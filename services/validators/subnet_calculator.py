from ipaddress import IPv4Network, AddressValueError, NetmaskValueError
from services.validators.subnet_validator import SubnetValidator

class SubnetCalculator:
    @staticmethod
    def calculate_subnet(local_ip, subnet):
        """
        Calculates subnet, netmask, and CIDR for a given IP and subnet mask.

        Args:
            local_ip (str): The local IP address.
            subnet (str): Subnet mask or prefix length (e.g., '24').

        Returns:
            dict: A dictionary containing 'subnet', 'netmask', and 'cidr'.

        Raises:
            ValueError: If the subnet or IP is invalid.
        """
        # Validate the subnet first
        if not SubnetValidator.validate_subnet(subnet):
            raise ValueError(f"Invalid subnet: {subnet}")

        # Validate the IP address
        try:
            network = IPv4Network(f"{local_ip}/{subnet}", strict=False)
        except (AddressValueError, NetmaskValueError) as e:
            raise ValueError(f"Invalid IP or subnet combination: {e}")

        # Return subnet information
        return {
            "subnet": str(network.network_address),
            "netmask": str(network.netmask),
            "cidr": str(network.prefixlen),
        }
