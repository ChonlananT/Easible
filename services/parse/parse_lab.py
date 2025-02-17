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

    for (hostname, raw_lines) in matches:
        line_pattern = re.compile(r'"([^"]*)"')
        lines_list = line_pattern.findall(raw_lines)

        result[hostname] = lines_list

    return result