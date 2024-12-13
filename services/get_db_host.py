from services.connect_db_host import get_connection

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