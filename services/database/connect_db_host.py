import psycopg2
import os

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "database": os.getenv("DB_NAME", "inventory"),
    "user": os.getenv("DB_USER", "admin"),
    "password": os.getenv("DB_PASSWORD", "P@ssw0rd")
}

# ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูล
def get_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print("Failed to connect to the database:", e)
        return None