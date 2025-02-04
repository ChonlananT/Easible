from services.database.connect_db_host import get_connection

def delete_group(group_name):
    """
    Deletes the specified group and removes all associations with hosts.
    """
    conn = get_connection()
    if not conn:
        return False, "Database connection failed."
    
    try:
        with conn.cursor() as cursor:
            # ตรวจสอบว่ากลุ่มมีอยู่ไหม
            cursor.execute("SELECT COUNT(*) FROM host_groups WHERE group_name = %s", (group_name,))
            count = cursor.fetchone()[0]
            if count == 0:
                return False, "Group does not exist."

            # ลบความสัมพันธ์ใน host_groups เฉพาะกลุ่มที่ระบุ
            cursor.execute("DELETE FROM host_groups WHERE group_name = %s", (group_name,))
            conn.commit()
            return True, "Group deleted successfully."
    except Exception as e:
        print("Error deleting group:", e)
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()