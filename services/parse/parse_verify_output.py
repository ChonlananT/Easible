import re

def parse_verify_output(log_text):
    """
    คืนค่าเฉพาะข้อมูลจาก TASK ที่ขึ้นต้นด้วย 'TASK [Display ... ]'
    ในรูปแบบ { hostname: [list ของแต่ละบรรทัดที่อยู่ใน msg] } 
    """
    # 1) ดึงเฉพาะบล็อกของ TASK ที่มีคำว่า Display ตรงกลาง
    #    ^TASK \[ : บรรทัดเริ่มต้นที่ขึ้นต้นด้วย TASK [
    #    (Display.*?) : จับชื่อ Task เฉพาะที่เริ่มด้วย Display
    #    .*? : จับข้อความถัดไปทั้งหมดในบรรทัดนั้น
    #    \n(.*?) : จับเนื้อหาถัดจากบรรทัดประกาศ TASK จนกว่าจะเจอ TASK [ หรือ PLAY หรือจบไฟล์
    task_pattern = re.compile(
        r'(?s)TASK \[(Display.*?)\].*?\n(.*?)(?=^TASK \[|^PLAY|\Z)',
        re.MULTILINE
    )

    # 2) ในแต่ละบล็อกของ Task ให้หา host ที่ขึ้นต้นด้วย ok: [R101] => { "msg": ... }
    host_pattern = re.compile(
        r'(?s)ok: \[([^]]+)\] => \{\s+"msg"\s*:\s*\[\s*\[\s*(.*?)\s*\]\s*\}\n?',
        re.MULTILINE
    )

    result = {}

    # วนลูปดูทุก TASK ที่ขึ้นต้นด้วย Display
    for (_, block_content) in task_pattern.findall(log_text):
        # หาทุก ok: [host]
        for (hostname, raw_lines) in host_pattern.findall(block_content):
            # ดึงเฉพาะ string ที่อยู่ภายใน "...."
            line_pattern = re.compile(r'"([^"]*)"')
            lines_list = line_pattern.findall(raw_lines)

            # ถ้า host นี้ยังไม่เคยเจอใน result ก็ให้ตั้งเป็น list ว่าง
            if hostname not in result:
                result[hostname] = []
            # ต่อท้าย lines_list เข้าไปใน result[hostname]
            result[hostname].extend(lines_list)

    return result
