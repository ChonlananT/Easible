from services.database.connect_db_host import get_connection

def assign_group_to_hosts(group_name, hostnames):
    """
    Assigns the specified group_name to a list of existing hosts.
    - group_name: ชื่อกลุ่มที่ต้องการเพิ่ม
    - hostnames: list ของ hostname ที่จะเพิ่มเข้า group
    """
    conn = get_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cursor:
            for hostname in hostnames:
                # 1) หาว่า host นี้มีอยู่จริงไหม
                cursor.execute("SELECT id FROM inventory WHERE hostname = %s", (hostname,))
                result = cursor.fetchone()
                if not result:
                    continue  # ถ้าไม่เจอ hostname นี้ ก็ข้ามไป

                host_id = result[0]

                # 2) ตรวจสอบซ้ำไหม ถ้าอยากป้องกัน insert ซ้ำ อาจตรวจสอบก่อน
                cursor.execute("""
                    SELECT id 
                    FROM host_groups 
                    WHERE host_id = %s AND group_name = %s
                """, (host_id, group_name))
                existing = cursor.fetchone()
                if existing:
                    # มีอยู่แล้ว ไม่ต้องเพิ่มซ้ำ
                    continue

                # 3) Insert ความสัมพันธ์ระหว่าง Host กับ Group
                cursor.execute("""
                    INSERT INTO host_groups (host_id, group_name)
                    VALUES (%s, %s)
                """, (host_id, group_name))

            conn.commit()
        return True
    except Exception as e:
        print("Error assigning group to hosts:", e)
        conn.rollback()
        return False
    finally:
        conn.close()