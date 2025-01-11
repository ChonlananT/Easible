import ipaddress

def calculate_network_id(prefix: str, cidr: int) -> str:
    """
    คำนวณ Network ID จาก Prefix และ CIDR

    Args:
        prefix (str): Prefix IP (อาจจะไม่ใช่ Network ID จริง)
        cidr (int): CIDR เช่น 24

    Returns:
        str: Network ID ที่ถูกต้อง
    """
    try:
        network = ipaddress.IPv4Network(f"{prefix}/{cidr}", strict=False)
        return str(network.network_address)
    except ValueError as e:
        raise ValueError(f"Invalid Prefix or CIDR: {e}")