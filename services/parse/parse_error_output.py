import re
import json

def parse_error_output(log_text):
    """
    Parses ansible-playbook output for fatal errors and returns a dictionary
    mapping each hostname to its error details.

    Example returned dictionary:
    {
        "R103": {
            "changed": false,
            "msg": "show ip routeasdasd\r\nshow ip routeasdasd\r\n             ^\r\n% Invalid input detected at '^' marker.\r\n\r\nR103#"
        }
    }

    If multiple error messages for a host are found, they will be stored in a list.
    """
    # This regex captures the error block:
    #   Group 1: The hostname (inside square brackets)
    #   Group 2: The JSON object containing the error details (using greedy matching)
    error_pattern = re.compile(
        r'(?s)fatal:\s+\[([^]]+)\]:\s+FAILED!\s+=>\s+(\{.*\})',
        re.MULTILINE
    )
    
    result = {}
    for match in error_pattern.finditer(log_text):
        hostname = match.group(1).strip()
        error_json_str = match.group(2).strip()
        try:
            error_data = json.loads(error_json_str)
        except json.JSONDecodeError:
            # If JSON parsing fails, save the raw error string.
            error_data = error_json_str
        
        if hostname in result:
            if not isinstance(result[hostname], list):
                result[hostname] = [result[hostname]]
            result[hostname].append(error_data)
        else:
            result[hostname] = error_data
    return result
