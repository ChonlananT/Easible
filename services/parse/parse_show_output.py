import re

def parse_show_output(log_text):
    """
    Returns a dictionary mapping each hostname to a list of dictionaries,
    where each dictionary has the keys:
    - "command": the command name (e.g., "sh ip route")
    - "show_output": a list of strings, which are the command output lines.
    """
    # 1) ดึง TASK ที่เป็น Display พร้อมคำสั่งที่ตามหลัง
    task_pattern = re.compile(
        r'(?s)TASK \[Display (.*?)\].*?\n(.*?)(?=^TASK \[|^PLAY|\Z)',
        re.MULTILINE
    )
    
    # 2) ดึง host กับ msg (เอาเฉพาะส่วนที่อยู่ใน "msg":)
    host_pattern = re.compile(
        r'(?s)ok:\s*\[([^]]+)\]\s*=>\s*\{\s*"msg"\s*:\s*(\[[^\}]+\])\s*\}',
        re.MULTILINE
    )
    
    # 3) ดึงแต่ละ sub-list ภายใน msg (ซึ่งแต่ละ sub-list คือผลลัพธ์ของแต่ละ command)
    sublist_pattern = re.compile(r'\[\s*((?:"[^"]*"(?:\s*,\s*)?)+)\s*\]')
    # 4) ดึงบรรทัดภายในแต่ละ sub-list
    line_pattern = re.compile(r'"([^"]*)"')
    
    result = {}
    
    # 5) loop ทีละ TASK (Display เท่านั้น)
    for task_match in task_pattern.finditer(log_text):
        # ตัวอย่างข้อความที่จับได้:
        # "output of 'sh ip route, sh ip int br, sh ip route ospf' on R102"
        task_command_text = task_match.group(1)
        # ดึงเฉพาะข้อความภายในเครื่องหมายคำพูดเดียว
        extracted = re.search(r"'([^']+)'", task_command_text)
        if extracted:
            command_names_str = extracted.group(1)
        else:
            command_names_str = task_command_text
        
        # แยกคำสั่งแต่ละตัวออกจากกัน
        command_names = [cmd.strip() for cmd in command_names_str.split(',')]
        
        block_content = task_match.group(2)
    
        # 6) loop ทีละ host ที่อยู่ใน task นี้
        for (hostname, raw_msg) in host_pattern.findall(block_content):
            sublists = sublist_pattern.findall(raw_msg)
            outputs = []
            for sub in sublists:
                # ดึงแต่ละบรรทัดใน sub-list
                lines = line_pattern.findall(sub)
                outputs.append(lines)
    
            # 7) ตรวจสอบว่าจำนวน command กับจำนวน sub-list เท่ากันหรือไม่
            if hostname not in result:
                result[hostname] = []
            if len(command_names) == len(outputs):
                # จับคู่ command กับผลลัพธ์ทีละตัว
                for cmd, out in zip(command_names, outputs):
                    result[hostname].append({
                        "command": cmd,
                        "show_output": out
                    })
            else:
                # fallback: ถ้าจำนวนไม่ตรงกันรวมทุกบรรทัดเข้าด้วยกัน
                combined = [line for sub in outputs for line in sub]
                for cmd in command_names:
                    result[hostname].append({
                        "command": cmd,
                        "show_output": combined
                    })
    return result