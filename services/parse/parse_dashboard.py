import re

def parse_dashboard(output):
    parsed_data = {
        "ok": [],
        "fatal": []
    }
    # 1) ดึงเฉพาะส่วนของ text ระหว่าง TASK [Run ... commands] กับ TASK [Display interface details]
    block_pattern = re.compile(
        r'(?s)'  # ทำให้ '.' match ข้ามหลายบรรทัด (dotall)
        r'TASK \[Run.*?commands\].*?\n'  # หา TASK [Run ... commands]
        r'(.*?)'  # กลุ่มเนื้อหาที่เราต้องการ
        r'(?=TASK \[Display interface details\])'  # Positive lookahead หยุดก่อน TASK [Display ...]
    )

    match_block = block_pattern.search(output)
    
    if match_block:
        block_content = match_block.group(1)

        # 2) หาเฉพาะบรรทัดที่เป็น ok: [xxx] หรือ fatal: [xxx]
        line_pattern = re.compile(r'^(ok|fatal): \[([^\]]+)\]', re.MULTILINE)
        results = line_pattern.findall(block_content)

        # 3) แยกออกมาว่าเป็น ok หรือ fatal
        for status, device in results:
            if status == "ok":
                parsed_data["ok"].append(device)
            elif status == "fatal":
                parsed_data["fatal"].append(device)

    return parsed_data