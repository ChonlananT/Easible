from services.connect_db_host import get_connection

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