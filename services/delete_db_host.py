from services.connect_db_host import get_connection

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