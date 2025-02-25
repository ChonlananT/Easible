import re
import json

def remove_time(text):
    """
    ลบข้อมูลเวลาที่อยู่ในรูปแบบ ", xx:xx:xx," ออกจากข้อความ
    """
    return re.sub(r',\s*\d{2}:\d{2}:\d{2}\s*,', '', text)

def normalize_text(text):
    """
    Normalize text โดยการลบช่องว่างเกินและรวมข้อความทุกบรรทัดเป็นสตริงเดียว
    """
    return " ".join(text.split())

def compare_expected_outputs(parsed_output, lab_commands):
    """
    เปรียบเทียบ expected output ที่ส่งมาจาก frontend (ในแต่ละ host_expected ของ lab_commands)
    กับข้อมูลที่ได้จาก parsed_output (โดย key เป็น hostname)

    คืนค่า dict ในรูปแบบ:
      { "status": "matched" หรือ "unmatch",
        "details": {
            "matched": { ... },
            "unmatch": { ... }
        }
      }
      
    โดยใน details ของแต่ละ host จะมี key:
      - command: คำสั่งที่ส่งเข้ามา
      - expected: ข้อความ expected (multiline string)
      - actual: รายการผลลัพธ์ที่ได้ (list ของ string)
      - diff: รายการของบรรทัดที่ไม่ตรงกัน (แต่ละ entry ระบุ expected กับ actual)
      
    โค้ดนี้จะละเว้นการเปรียบเทียบข้อมูลเวลาที่อยู่ในรูปแบบ ", xx:xx:xx," ด้วย
    """
    result = {
        "matched": {},
        "unmatch": {}
    }
    
    for cmd in lab_commands:
        command_text = cmd.get("command")
        host_expected_list = cmd.get("host_expected", [])
        for host_exp in host_expected_list:
            hostname = host_exp.get("hostname")
            expected = host_exp.get("expected_output", "")
            
            # นำข้อมูลเวลาที่อยู่ใน expected ออกก่อนที่จะ normalize
            expected_no_time = remove_time(expected)
            normalized_expected = normalize_text(expected_no_time)

            actual_lines = parsed_output.get(hostname, [])
            combined_actual = "\n".join(actual_lines)
            # นำข้อมูลเวลาที่อยู่ใน actual ออกก่อน normalize
            actual_no_time = remove_time(combined_actual)
            normalized_actual = normalize_text(actual_no_time)

            # ฟังก์ชันสำหรับสร้าง diff แบบบรรทัดต่อบรรทัด
            def generate_diff(expected_str, actual_list):
                diff_list = []
                expected_lines = expected_str.splitlines()
                max_lines = max(len(expected_lines), len(actual_list))
                for i in range(max_lines):
                    exp_line = expected_lines[i] if i < len(expected_lines) else ""
                    act_line = actual_list[i] if i < len(actual_list) else ""
                    # นำข้อมูลเวลาที่อยู่ในแต่ละบรรทัดออกก่อนเปรียบเทียบ
                    if normalize_text(remove_time(exp_line)) != normalize_text(remove_time(act_line)):
                        diff_list.append({
                            "expected": exp_line,
                            "actual": act_line
                        })
                return diff_list

            # ถ้า expected เป็นค่าว่าง ถือว่า matched
            if normalized_expected == "":
                result["matched"].setdefault(hostname, []).append({
                    "command": command_text,
                    "expected": expected,
                    "actual": actual_lines,
                    "diff": []
                })
            else:
                if normalized_expected in normalized_actual:
                    result["matched"].setdefault(hostname, []).append({
                        "command": command_text,
                        "expected": expected,
                        "actual": actual_lines,
                        "diff": []
                    })
                else:
                    diff = generate_diff(expected, actual_lines)
                    result["unmatch"].setdefault(hostname, []).append({
                        "command": command_text,
                        "expected": expected,
                        "actual": actual_lines,
                        "diff": diff
                    })

    status = "unmatch" if result["unmatch"] else "matched"
    return {"status": status, "details": {"matched": result["matched"], "unmatch": result["unmatch"]}}
