import json
from services.get_db_host import fetch_all_devices

def generate_inventory_content():
    # Fetch devices from the database
    devices = fetch_all_devices()

    # Initialize the inventory content string
    inventory_content = ""

    # Iterate through the devices and generate the inventory content
    for device in devices:
        # Extracting relevant information from each device
        device_type = device.get("deviceType")
        hostname = device.get("hostname")
        ip_address = device.get("ipAddress")
        enable_password = device.get("enablePassword")
        username = device.get("username")
        password = device.get("password")

        # Start by adding device block
        inventory_content += f"[{device['id']}]\n"
        inventory_content += f"{hostname} ansible_host={ip_address}\n"

        # Add variables if there is an enablePassword
        inventory_content += f"\n[{device['id']}:vars]\n"
        inventory_content += f"ansible_network_os=ios\n"
        inventory_content += f"ansible_user={username}\n"
        inventory_content += f"ansible_password={password}\n"
        inventory_content += "ansible_connection=network_cli\n"

        # Add ansible_become variables if enablePassword is provided
        if enable_password:
            inventory_content += "ansible_become=yes\n"
            inventory_content += "ansible_become_method=enable\n"
            inventory_content += f"ansible_become_password={enable_password}\n"
        else:
            # If no enablePassword, we don't add ansible_become variables
            inventory_content += "ansible_become=no\n"

        inventory_content += "\n"

    # Return the generated inventory content
    return inventory_content
