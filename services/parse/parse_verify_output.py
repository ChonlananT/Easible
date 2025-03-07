import re

def parse_verify_output(log_text):
    """
    Returns a dictionary mapping each hostname to a list of dictionaries,
    where each dictionary has the keys "task" (the task name) and "msg" (a list of messages)
    extracted from the TASK block.

    For example:
    {
        "R101": [
            {
                "task": "Display ...",
                "msg": ["line1", "line2", ...]
            },
            ...
        ],
        "R102": [...],
    }
    """
    # 1) Extract blocks of TASKs that have 'Display' in the task name.
    #    The pattern captures:
    #    - Group 1: Task name starting with "Display"
    #    - Group 2: The content after the TASK declaration, until the next TASK [ or PLAY or end of file.
    task_pattern = re.compile(
        r'(?s)TASK \[(Display.*?)\].*?\n(.*?)(?=^TASK \[|^PLAY|\Z)',
        re.MULTILINE
    )

    # 2) Within each TASK block, find lines that match the host output pattern:
    #    - Group 1: Hostname (e.g., R101)
    #    - Group 2: Raw content of the msg field.
    host_pattern = re.compile(
        r'(?s)ok: \[([^]]+)\] => \{\s+"msg"\s*:\s*\[\s*\[\s*(.*?)\s*\]\s*\}\n?',
        re.MULTILINE
    )

    # This pattern extracts individual string values from the msg field.
    line_pattern = re.compile(r'"([^"]*)"')

    result = {}

    # Loop over every TASK block with a "Display" task.
    for task_match in task_pattern.finditer(log_text):
        task_name = task_match.group(1)
        block_content = task_match.group(2)

        # Find all host messages in the block.
        for (hostname, raw_lines) in host_pattern.findall(block_content):
            # Extract individual lines from the raw_lines.
            lines_list = line_pattern.findall(raw_lines)

            # If this host isn't in the result yet, initialize with an empty list.
            if hostname not in result:
                result[hostname] = []

            # Append the current task's data to the host's list.
            result[hostname].append({
                "msg": lines_list,
                "task": task_name
            })

    
    return result
