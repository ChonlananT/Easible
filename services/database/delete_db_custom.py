from services.database.connect_db_custom import get_connection_custom

def delete_custom_lab_in_db(lab_id):
    """ลบ custom_lab (และ lab_commands ที่เกี่ยวข้องจะถูกลบด้วยจาก ON DELETE CASCADE)"""
    conn = get_connection_custom()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM custom_labs WHERE id = %s;", (lab_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()