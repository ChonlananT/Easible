from services.database.connect_db_host import get_connection

def fetch_all_devices():
    query = """
        SELECT
            inventory.id,
            inventory.device_type,
            inventory.hostname,
            inventory.ipaddress,
            inventory.username,
            inventory.password,
            inventory.enable_password,
            COALESCE(array_agg(host_groups.group_name) FILTER (WHERE host_groups.group_name IS NOT NULL), ARRAY[]::VARCHAR[]) AS groups
        FROM
            inventory
        LEFT JOIN
            host_groups ON inventory.id = host_groups.host_id
        GROUP BY
            inventory.id;
    """
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
                        "groups": row[7],  # Array of group names
                    }
                    for row in rows
                ]
                return devices
        except Exception as e:
            print("Error fetching devices:", e)
            return []
        finally:
            conn.close()
