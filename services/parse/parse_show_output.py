import re

def parse_show_output(log_text):
    """
    Returns a dictionary mapping each hostname to a list of dictionaries,
    where each dictionary has the keys:
    - "command": the command name (e.g., "show ip route")
    - "show_output": a list of strings, which are the command output lines.

    Example:
    {
        "R101": [
            {
                "command": "show ip route",
                "show_output": ["line1", "line2", ...]
            },
            {
                "command": "show ip int br",
                "show_output": ["line1", "line2", ...]
            }
        ],
        "R102": [...],
    }
    """

    # 1) ดึง TASK ที่เป็น Display พร้อมคำสั่งที่ตามหลัง
    task_pattern = re.compile(
        r'(?s)TASK \[Display (.*?)\].*?\n(.*?)(?=^TASK \[|^PLAY|\Z)',
        re.MULTILINE
    )

    # 2) ดึง host กับ msg
    host_pattern = re.compile(
        r'(?s)ok: \[([^]]+)\] => \{\s+"msg"\s*:\s*\[\s*\[\s*(.*?)\s*\]\s*\}\n?',
        re.MULTILINE
    )

    # 3) ดึงข้อความใน msg
    line_pattern = re.compile(r'"([^"]*)"')

    result = {}

    # 4) loop ทีละ TASK (Display เท่านั้น)
    for task_match in task_pattern.finditer(log_text):
        command_name = task_match.group(1)  # ชื่อคำสั่ง เช่น show ip route
        block_content = task_match.group(2)

        # 5) loop ทีละ host ที่อยู่ใน task นี้
        for (hostname, raw_lines) in host_pattern.findall(block_content):
            lines_list = line_pattern.findall(raw_lines)

            # แยกคำสั่งออกจากกันถ้ามีหลายคำสั่งใน 'command'
            commands = command_name.split(',')  # ถ้าหลายคำสั่งจะถูกแยก
            for command in commands:
                command = command.strip()  # ลบช่องว่างส่วนเกิน
                # 6) สร้าง list ว่างถ้ายังไม่มี host นี้
                if hostname not in result:
                    result[hostname] = []

                # 7) เพิ่มข้อมูลเข้าไปใน host นั้น
                result[hostname].append({
                    "command": command,
                    "show_output": lines_list
                })

    return result
