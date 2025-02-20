from services.database import fetch_all_devices

def generate_inventory_content(selected_groups):
    # ตรวจสอบว่ามีการเลือกกลุ่มอย่างน้อยหนึ่งกลุ่ม
    if not selected_groups:
        raise ValueError("No groups selected for inventory creation.")

    # Fetch devices from the database
    devices = fetch_all_devices()

    # Initialize the inventory content string
    inventory_content = ""

    # -- สร้างข้อมูลของทุกอุปกรณ์ที่มีใน Database -- #
    # (เราจะสร้างบล็อก [hostname] + [hostname:vars] สำหรับอุปกรณ์ทุกตัวเลย)
    
    # รวบรวม hostname ทั้งหมด (เผื่อใช้ใน Alldevice)
    all_hostnames = set()

    # เตรียมโครงสร้างสำหรับเลือกกลุ่มภายหลัง
    groups = {}  # สำหรับเก็บว่ามี group (key) ไหนบ้าง => มี host ใดบ้าง
    for device in devices:
        # เอา hostname ไปเก็บเพื่อทำกลุ่ม Alldevice
        hostname = device.get("hostname")
        all_hostnames.add(hostname)

    # สร้างบล็อก detail ของทุกอุปกรณ์แบบไม่สนว่าอยู่กลุ่มใด
    for device in devices:
        hostname = device.get("hostname")
        ip_address = device.get("ipAddress")
        enable_password = device.get("enablePassword")
        username = device.get("username")
        password = device.get("password")

        # บล็อก [hostname]
        inventory_content += f"[{hostname}]\n"
        inventory_content += f"{hostname} ansible_host={ip_address} ansible_ssh_timeout=3\n\n"

        # บล็อก [hostname:vars]
        inventory_content += f"[{hostname}:vars]\n"
        inventory_content += "ansible_network_os=ios\n"
        inventory_content += f"ansible_user={username}\n"
        inventory_content += f"ansible_password={password}\n"
        inventory_content += "ansible_connection=network_cli\n"

        if enable_password:
            inventory_content += "ansible_become=yes\n"
            inventory_content += "ansible_become_method=enable\n"
            inventory_content += f"ansible_become_password={enable_password}\n"
        else:
            inventory_content += "ansible_become=no\n"

        inventory_content += "\n"

    # -- จัดการเรื่องกลุ่ม (selectedgroup, selectedgrouprouter, selectedgroupswitch, Alldevice) -- #

    # ดึง groups ที่จริงออกมาจากฐานข้อมูล (ถ้ามี key "groups" ในแต่ละ device)
    # เผื่อใช้งานภายหลัง หรือถ้าไม่มีสามารถข้ามได้
    for device in devices:
        hostname = device.get("hostname")
        for group in device.get("groups", []):
            if group not in groups:
                groups[group] = []
            groups[group].append(hostname)

    # แปลง selected_groups เป็น set สำหรับประสิทธิภาพในการค้นหา
    selected_groups_set = set(selected_groups)

    # ตรวจสอบว่ามีการเลือก "All Devices" หรือไม่
    include_all_devices = "All Devices" in selected_groups_set

    # สร้างเซ็ต host ที่ผู้ใช้เลือก (ยกเว้น "All Devices" เพราะคือทั้งหมด)
    selected_hostnames = set()
    for group in selected_groups_set:
        if group != "All Devices":
            selected_hostnames.update(groups.get(group, []))

    # ถ้าเลือก "All Devices" ให้เอา host ทั้งหมดในฐานข้อมูล
    if include_all_devices:
        selected_hostnames = all_hostnames.copy()

    # เตรียมกลุ่ม selectedgroup (รวม host ตามที่ผู้ใช้เลือก)
    new_group_name = "selectedgroup"
    selectedgroup_router = set()
    selectedgroup_switch = set()

    # แยกประเภท router/switch เฉพาะที่อยู่ใน selected_hostnames
    for device in devices:
        hostname = device.get("hostname")
        if hostname in selected_hostnames:
            device_type = device.get("deviceType", "").lower()
            if device_type == "router":
                selectedgroup_router.add(hostname)
            elif device_type == "switch":
                selectedgroup_switch.add(hostname)

    # -- เขียนกลุ่ม selectedgroup -- #
    inventory_content += f"[{new_group_name}]\n"
    for hostname in sorted(selected_hostnames):
        inventory_content += f"{hostname}\n"
    inventory_content += "\n"

    # -- เขียนกลุ่ม selectedgrouprouter -- #
    new_group_router = "selectedgrouprouter"
    inventory_content += f"[{new_group_router}]\n"
    for hostname in sorted(selectedgroup_router):
        inventory_content += f"{hostname}\n"
    inventory_content += "\n"

    # -- เขียนกลุ่ม selectedgroupswitch -- #
    new_group_switch = "selectedgroupswitch"
    inventory_content += f"[{new_group_switch}]\n"
    for hostname in sorted(selectedgroup_switch):
        inventory_content += f"{hostname}\n"
    inventory_content += "\n"

    # -- สุดท้าย เขียนกลุ่ม Alldevice ซึ่งใส่ host ของทุกอุปกรณ์ -- #
    inventory_content += "[Alldevice]\n"
    for hostname in sorted(all_hostnames):
        inventory_content += f"{hostname}\n"
    inventory_content += "\n"

    return inventory_content
