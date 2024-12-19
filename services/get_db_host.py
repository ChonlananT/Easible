from services.connect_db_host import get_connection

def fetch_all_devices():
    query = "SELECT * FROM inventory;"
    conn = get_connection()
    if conn:
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
                devices = [
                    {
                        "id": row[0],
                        "deviceType": row[1],
                        "hostname": row[2],
                        "ipAddress": row[3],
                        "username": row[4],
                        "password": row[5],
                        "enablePassword": row[6],
                    }
                    for row in rows
                ]
                return devices
        except Exception as e:
            print("Error fetching devices:", e)
            return []
        finally:
            conn.close()
