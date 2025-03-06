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
    
    # ฟังก์ชันสำหรับสร้าง diff โดยเปรียบเทียบแต่ละบรรทัดจาก expected กับ actual โดยไม่อิงลำดับ
    def generate_diff(expected_str, actual_list):
        diff_list = []
        # แยกบรรทัดและกรองบรรทัดว่างออกไป
        expected_lines = [line for line in expected_str.splitlines() if line.strip() != ""]
        actual_lines = [line for line in actual_list if line.strip() != ""]
        
        # สร้างรายการ normalized สำหรับ expected และ actual
        normalized_expected = [normalize_text(remove_time(line)) for line in expected_lines]
        normalized_actual = [normalize_text(remove_time(line)) for line in actual_lines]
        
        # ตรวจสอบบรรทัดที่คาดหวัง (expected) ว่ามีอยู่ใน actual หรือไม่
        for idx, norm_exp in enumerate(normalized_expected):
            if norm_exp not in normalized_actual:
                diff_list.append({
                    "expected": expected_lines[idx],
                    "actual": "Not Found"
                })
        
        # ตรวจสอบบรรทัดที่มีใน actual แต่ไม่พบใน expected
        for idx, norm_act in enumerate(normalized_actual):
            if norm_act not in normalized_expected:
                diff_list.append({
                    "expected": "Not Expected",
                    "actual": actual_lines[idx]
                })
        return diff_list

    for cmd in lab_commands:
        command_text = cmd.get("command")
        host_expected_list = cmd.get("host_expected", [])
        for host_exp in host_expected_list:
            hostname = host_exp.get("hostname")
            expected = host_exp.get("expected_output", "")
            
            # ลบข้อมูลเวลาที่อยู่ใน expected ก่อน normalize
            expected_no_time = remove_time(expected)
            normalized_expected = normalize_text(expected_no_time)
            
            actual_lines = parsed_output.get(hostname, [])
            combined_actual = "\n".join(actual_lines)
            # ลบข้อมูลเวลาที่อยู่ใน actual ก่อน normalize
            actual_no_time = remove_time(combined_actual)
            normalized_actual = normalize_text(actual_no_time)
            
            # ถ้า expected เป็นค่าว่าง ถือว่า matched
            if normalized_expected == "":
                result["matched"].setdefault(hostname, []).append({
                    "command": command_text,
                    "expected": expected,
                    "actual": actual_lines,
                    "diff": []
                })
            else:
                # ใช้วิธีตรวจสอบแต่ละบรรทัดจาก expected กับ actual โดยไม่อิงลำดับ
                diff = generate_diff(expected, actual_lines)
                if not diff:
                    result["matched"].setdefault(hostname, []).append({
                        "command": command_text,
                        "expected": expected,
                        "actual": actual_lines,
                        "diff": []
                    })
                else:
                    result["unmatch"].setdefault(hostname, []).append({
                        "command": command_text,
                        "expected": expected,
                        "actual": actual_lines,
                        "diff": diff
                    })

    status = "unmatch" if result["unmatch"] else "matched"
    return {"status": status, "details": {"matched": result["matched"], "unmatch": result["unmatch"]}}
