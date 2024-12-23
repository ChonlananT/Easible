import psycopg2

DB_CONFIG = {
    "host": "127.0.0.1",  # แทนที่ด้วย IP Address ของ VM
    "database": "inventory",
    "user":"suphanath",
    "password":"Admin!1234"
}

# ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูล
def get_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print("Failed to connect to the database:", e)
        return None