import re
import json

def parse_ansible_output(log_text):
    pattern = re.compile(
        r'(?s)ok: \[([^]]+)\] => \{\s+"msg"\s*:\s*\[\s*\[\s*(.*?)\s*\]\s*\]\s*\}',
        re.MULTILINE
    )

    matches = pattern.findall(log_text)

    # โครงสร้างเก็บผลลัพธ์: {"SW103": [...], "SW101": [...], ...}
    result = {}

    # Regex สำหรับจับ pattern เวลาในรูปแบบ ", xx:xx:xx,"
    time_pattern = re.compile(r',\s*\d{2}:\d{2}:\d{2}\s*,')
    
    for (hostname, raw_lines) in matches:
        line_pattern = re.compile(r'"([^"]*)"')
        lines_list = line_pattern.findall(raw_lines)

        # ลบส่วนของเวลาที่ตรงกับ pattern ออกจากแต่ละบรรทัด
        processed_lines = [time_pattern.sub("", line) for line in lines_list]
        
        result[hostname] = processed_lines

    return result
