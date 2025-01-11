import ipaddress

def cidr_to_subnet_mask(cidr):
    try:
        network = ipaddress.IPv4Network(f'0.0.0.0/{cidr}')
        return str(network.netmask)
    except ValueError:
        return None