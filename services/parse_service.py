import re

def parse_result(data):
    output = ''.join(data["stdout_lines"][0])  # Joining lines into one string
    match = re.findall(r'\[(.*?)\]', output)   # Regex to find text in square brackets
    return match
