from services.database import fetch_all_devices

def generate_inventory_content(selected_groups):
    # ตรวจสอบว่ามีการเลือกกลุ่มอย่างน้อยหนึ่งกลุ่ม
    if not selected_groups:
        raise ValueError("No groups selected for inventory creation.")

    # Fetch devices from the database
    devices = fetch_all_devices()

    # Initialize the inventory content string
    inventory_content = ""

    # Initialize a dictionary to map group names to hostnames
    groups = {}

    # Initialize a set to keep track of all hostnames
    all_hostnames = set()

    # Iterate through the devices to populate groups and all_hostnames
    for device in devices:
        hostname = device.get("hostname")
        all_hostnames.add(hostname)

        # Assign the host to each group it belongs to
        for group in device.get("groups", []):
            if group not in groups:
                groups[group] = []
            groups[group].append(hostname)

    # แปลง selected_groups เป็น set สำหรับประสิทธิภาพในการค้นหา
    selected_groups_set = set(selected_groups)

    # ตรวจสอบว่ามีการเลือก "All Devices" หรือไม่
    include_all_devices = "All Devices" in selected_groups_set

    # Initialize a set of hostnames to include based on selected groups
    selected_hostnames = set()

    # Add hosts from selected groups (ยกเว้น "All Devices" ซึ่งจะเพิ่มทีหลัง)
    for group in selected_groups_set:
        if group == "All Devices":
            continue  # Handle "All Devices" separately
        selected_hostnames.update(groups.get(group, []))

    # ถ้าเลือก "All Devices" ให้เพิ่ม host ทั้งหมด
    if include_all_devices:
        selected_hostnames = all_hostnames.copy()

    # Define a new group name "selectedgroup"
    new_group_name = "selectedgroup"
    # เพิ่มกลุ่ม "selectedgroup" ลงใน groups (สำหรับทุก host ที่เลือก)
    groups[new_group_name] = sorted(selected_hostnames)

    # เตรียมตัวแปรสำหรับเก็บ hostnames ตามประเภท device_type
    selectedgroup_router = set()
    selectedgroup_switch = set()

    # First, define each host with its variables, only if it's included
    for device in devices:
        hostname = device.get("hostname")
        if hostname not in selected_hostnames:
            continue  # Skip hosts not in selected groups

        ip_address = device.get("ipAddress")
        enable_password = device.get("enablePassword")
        username = device.get("username")
        password = device.get("password")

        # ตรวจสอบ device_type โดยใช้ key "deviceType" จาก database
        device_type = device.get("deviceType", "").lower()
        if device_type == "router":
            selectedgroup_router.add(hostname)
        elif device_type == "switch":
            selectedgroup_switch.add(hostname)

        # Start by adding device block
        inventory_content += f"[{hostname}]\n"
        inventory_content += f"{hostname} ansible_host={ip_address}\n"

        # Add variables for the host
        inventory_content += f"\n[{hostname}:vars]\n"
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

    # Next, define the "selectedgroup" and assign hosts to it
    inventory_content += f"[{new_group_name}]\n"
    for hostname in sorted(groups[new_group_name]):
        inventory_content += f"{hostname}\n"
    inventory_content += "\n"

    # เพิ่มกลุ่มสำหรับ router
    new_group_router = "selectedgrouprouter"
    inventory_content += f"[{new_group_router}]\n"
    for hostname in sorted(selectedgroup_router):
        inventory_content += f"{hostname}\n"
    inventory_content += "\n"

    # เพิ่มกลุ่มสำหรับ switch
    new_group_switch = "selectedgroupswitch"
    inventory_content += f"[{new_group_switch}]\n"
    for hostname in sorted(selectedgroup_switch):
        inventory_content += f"{hostname}\n"
    inventory_content += "\n"

    # Return the generated inventory content
    return inventory_content
