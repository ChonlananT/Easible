import psycopg2
import re

# ตั้งค่าการเชื่อมต่อ
DB_CONFIG = {
    "host": "127.0.0.1",  # แทนที่ด้วย IP Address ของ VM
    "database": "inventory",
    "user":"suphanath",
    "password":"Admin!1234"
}

# ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูล
def get_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print("Failed to connect to the database:", e)
        return None

# ฟังก์ชันเพิ่มข้อมูล
def add_device(device_type, hostname, ipaddress, username, password, enable_password):
    query = """
    INSERT INTO inventory (device_type, hostname, ipaddress, username, password, enable_password)
    VALUES (%s, %s, %s, %s, %s, %s);
    """
    conn = get_connection()
    if conn:
        try:
            with conn.cursor() as cursor:
                cursor.execute(query, (device_type, hostname, ipaddress, username, password, enable_password))
                conn.commit()
                print(f"Device '{hostname}' added successfully.")
        except Exception as e:
            print("Error adding device:", e)
        finally:
            conn.close()

# ฟังก์ชันลบข้อมูล
def delete_device(hostname):
    query = "DELETE FROM inventory WHERE hostname = %s;"
    conn = get_connection()
    if conn:
        try:
            with conn.cursor() as cursor:
                cursor.execute(query, (hostname,))
                conn.commit()
                print(f"Device '{hostname}' deleted successfully.")
        except Exception as e:
            print("Error deleting device:", e)
        finally:
            conn.close()

# ฟังก์ชันดึงข้อมูลทั้งหมด
def fetch_all_devices():
    query = "SELECT * FROM inventory;"
    conn = get_connection()
    if conn:
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
                print("ID | Device Type | Hostname | IP Address  | Username | Password | Enable Password")
                print("-" * 80)
                for row in rows:
                    print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]} | {row[6]}")
        except Exception as e:
            print("Error fetching devices:", e)
        finally:
            conn.close()

def parse_interface(output):
    """
    Parses the Ansible output to extract hostname, interface, and details (IP address and status).
    """
    import re
    parsed_data = []

    # Split the output by hosts
    host_blocks = re.split(r"ok: \[([^\]]+)\]", output)
    
    # Host blocks alternate: empty string, hostname, data
    for i in range(1, len(host_blocks), 2):
        hostname = host_blocks[i].strip()
        data = host_blocks[i + 1]

        # Extract lines with interface details
        lines = re.findall(r"^\s*([^\s]+)\s+([^\s]+)\s+YES\s+[^\s]+\s+(.+?)\s{2,}", data, re.MULTILINE)
        interface_list = []
        for line in lines:
            interface, ip_address, status = line
            # Handle "administratively down"
            if "administratively down" in status:
                status = "administratively down"
            interface_list.append({
                "interface": interface,
                "detail": {
                    "ip_address": ip_address,
                    "status": status.strip()
                }
            })
        
        # Add the hostname with its interfaces
        parsed_data.append({
            "hostname": hostname,
            "interfaces": interface_list
        })
    
    return parsed_data


data = """
TASK [Filter interface details] ****************************************************************************************
ok: [SW401] => {
    "msg": [
        [
            "Interface              IP-Address      OK? Method Status                Protocol",
            "Vlan1                  unassigned      YES NVRAM  up                    down    ",
            "Vlan434                192.168.40.21   YES NVRAM  up                    up      ",
            "FastEthernet0          unassigned      YES NVRAM  down                  down    ",
            "GigabitEthernet1/0/1   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/2   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/3   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/4   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/5   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/6   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/7   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/8   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/9   unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/10  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/11  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/12  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/13  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/14  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/15  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/16  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/17  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/18  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/19  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/20  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/21  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/22  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/23  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/24  unassigned      YES unset  up                    up      ",
            "GigabitEthernet1/0/25  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/26  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/27  unassigned      YES unset  down                  down    ",
            "GigabitEthernet1/0/28  unassigned      YES unset  down                  down"
        ]
    ]
}
ok: [R401] => {
    "msg": [
        [
            "Interface              IP-Address      OK? Method Status                Protocol",
            "GigabitEthernet0/0/0   192.168.40.11   YES NVRAM  up                    up      ",
            "GigabitEthernet0/0/1   unassigned      YES NVRAM  administratively down down    ",
            "Serial0/1/0            unassigned      YES NVRAM  administratively down down    ",
            "Serial0/1/1            unassigned      YES NVRAM  administratively down down"
        ]
    ]
}
"""

# ฟังก์ชันหลักสำหรับทดสอบ
if __name__ == "__main__":
    print("1. Add Device")
    print("2. Delete Device")
    print("3. Fetch All Devices")
    print("4. Parse Interface Data")
    choice = input("Enter your choice: ")

    if choice == "1":
        device_type = input("Enter device type (router/switch): ")
        hostname = input("Enter hostname: ")
        ipaddress = input("Enter IP address: ")
        username = input("Enter username: ")
        password = input("Enter password: ")
        enable_password = input("Enter enable password (optional): ")
        add_device(device_type, hostname, ipaddress, username, password, enable_password or None)
    elif choice == "2":
        hostname = input("Enter the hostname of the device to delete: ")
        delete_device(hostname)
    elif choice == "3":
        fetch_all_devices()
    elif choice == "4":
        parsed_data = parse_interface(data)
        print(parsed_data)
    else:
        print("Invalid choice")

