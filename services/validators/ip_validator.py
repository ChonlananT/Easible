from ipaddress import ip_address

class IPValidator:
    @staticmethod
    def validate_ip(ip):
        """
        Validate if the given string is a valid IP address (IPv4 or IPv6).

        Args:
            ip (str): IP address to validate.

        Returns:
            bool: True if valid, False otherwise.
        """
        try:
            ip_address(ip)  # Attempts to parse the IP address
            return True
        except ValueError:
            return False
