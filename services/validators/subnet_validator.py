from ipaddress import ip_network

class SubnetValidator:
    @staticmethod
    def validate_subnet(subnet):
        """
        Validate if the given string is a valid subnet prefix length (e.g., '24').

        Args:
            subnet (str): Subnet prefix length, e.g., '24'.

        Returns:
            bool: True if valid, False otherwise.
        """
        try:
            # Validate subnet prefix length by attempting to create a network (IPv4)
            ip_network(f'0.0.0.0/{subnet}', strict=False)
            return True
        except ValueError:
            return False

    @staticmethod
    def subnet_to_mask(subnet):
        """
        Convert a subnet in CIDR format (e.g., '24') to a subnet mask (e.g., '255.255.255.0').

        Args:
            subnet (str): Subnet prefix length, e.g., '24'.

        Returns:
            str: Subnet mask, e.g., '255.255.255.0', or None if invalid.
        """
        try:
            # Generate a subnet mask from CIDR (IPv4 only)
            network = ip_network(f'0.0.0.0/{subnet}', strict=False)
            return str(network.netmask)
        except ValueError:
            return None
