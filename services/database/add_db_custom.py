from services.database.connect_db_custom import get_connection_custom

def create_custom_lab_in_db(name, description, lab_commands):
    """
    สร้าง custom lab ใหม่และ insert lab_commands โดยที่ lab_commands แต่ละรายการ
    จะมี key "host_expected" ซึ่งเป็น list ของ object ที่มี "host_id" และ "expected_output"
    """
    conn = get_connection_custom()
    try:
        with conn.cursor() as cursor:
            # สร้าง custom lab ใหม่
            cursor.execute(
                "INSERT INTO custom_labs (name, description) VALUES (%s, %s) RETURNING id;",
                (name, description)
            )
            custom_lab_id = cursor.fetchone()[0]

            # สำหรับแต่ละ command ใน lab_commands
            for command in lab_commands:
                cmd_text = command.get("command")
                command_order = command.get("command_order")
                device_type = command.get("command_type")  # เช่น 'all', 'router', 'switch'
                
                # ดึงข้อมูล host_expected ซึ่งเป็น list ของ object
                host_expected_list = command.get("host_expected", [])
                # สร้าง array สำหรับ hostnames และ host_expected_outputs จาก host_expected_list
                hostnames = [item.get("hostname") for item in host_expected_list]
                host_expected_outputs = [item.get("expected_output") for item in host_expected_list]
                
                cursor.execute(
                    """
                    INSERT INTO lab_commands 
                        (custom_lab_id, command, hostnames, host_expected_outputs, command_order, device_type)
                    VALUES (%s, %s, %s, %s, %s, %s);
                    """,
                    (custom_lab_id, cmd_text, hostnames, host_expected_outputs, command_order, device_type)
                )
        conn.commit()
        return custom_lab_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
