from services.database.connect_db_custom import get_connection_custom

def update_custom_lab_in_db(lab_id, name, description, lab_commands):
    """
    อัปเดต custom lab และ lab_commands ที่เกี่ยวข้องโดยการลบ lab_commands เก่าแล้ว insert ใหม่
    โดยข้อมูล lab_commands แต่ละรายการจะมี key "host_expected" เพื่อเก็บ host และ expected output per host
    """
    conn = get_connection_custom()
    try:
        with conn.cursor() as cursor:
            # อัปเดต custom_labs
            cursor.execute(
                "UPDATE custom_labs SET name = %s, description = %s WHERE id = %s;",
                (name, description, lab_id)
            )
            # ลบ lab_commands เก่าที่เกี่ยวข้องกับ lab_id นี้
            cursor.execute("DELETE FROM lab_commands WHERE custom_lab_id = %s;", (lab_id,))
            
            # Insert lab_commands ใหม่
            for command in lab_commands:
                cmd_text = command.get("command")
                command_order = command.get("command_order")
                device_type = command.get("command_type")
                
                host_expected_list = command.get("host_expected", [])
                hostnames = [item.get("hostname") for item in host_expected_list]
                host_expected_outputs = [item.get("expected_output") for item in host_expected_list]
                
                cursor.execute(
                    """
                    INSERT INTO lab_commands 
                        (custom_lab_id, command, hostnames, host_expected_outputs, command_order, device_type)
                    VALUES (%s, %s, %s, %s, %s, %s);
                    """,
                    (lab_id, cmd_text, hostnames, host_expected_outputs, command_order, device_type)
                )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
