from services.database.connect_db_custom import get_connection_custom

def fetch_all_custom_labs():
    """
    ดึงข้อมูล custom labs ทั้งหมดพร้อม lab_commands ที่เกี่ยวข้อง
    โดยรวมข้อมูล host ในแต่ละ command ให้อยู่ใน key "host_expected" เป็น list ของ object
    """
    conn = get_connection_custom()
    labs = []
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, description FROM custom_labs;")
            lab_rows = cursor.fetchall()
            for lab in lab_rows:
                lab_id, name, description = lab

                # ดึง lab_commands สำหรับ lab_id นี้
                cursor.execute(
                    """
                    SELECT id, command, hostnames, host_expected_outputs, command_order, device_type 
                    FROM lab_commands 
                    WHERE custom_lab_id = %s 
                    ORDER BY command_order;
                    """,
                    (lab_id,)
                )
                commands = cursor.fetchall()
                lab_commands = []
                for cmd in commands:
                    cmd_id, command_text, hostnames, host_expected_outputs, command_order, device_type = cmd
                    # รวมข้อมูล host_expected เป็น list ของ object
                    host_expected = []
                    if hostnames and host_expected_outputs and len(hostnames) == len(host_expected_outputs):
                        for h_name, exp_out in zip(hostnames, host_expected_outputs):
                            host_expected.append({
                                "hostname": h_name,
                                "expected_output": exp_out
                            })

                    lab_commands.append({
                        "id": cmd_id,
                        "command": command_text,
                        "host_expected": host_expected,
                        "command_order": command_order,
                        "device_type": device_type
                    })

                labs.append({
                    "id": lab_id,
                    "name": name,
                    "description": description,
                    "lab_commands": lab_commands
                })
        return labs
    except Exception as e:
        raise e
    finally:
        conn.close()
