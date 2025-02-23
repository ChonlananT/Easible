def compare_routing_tables(expected_tables, actual_routes):
    """
    expected_tables: the `routing_tables` object from the frontend
    actual_routes: the parsed result from parse_routes
    Returns a dict like:
    {
      "R101": {
        "all_matched": True,
        "matched_entries": [...],
        "unmatched_entries": [...]
      },
      "R102": ...
    }
    """
    results = {}

    for host, expected_routes in expected_tables.items():
        # actual parsed routes from the device
        host_actual = actual_routes.get(host, [])
        matched = []
        unmatched = []

        for exp in expected_routes:
            found = False
            for act in host_actual:
                if (exp.get("subnet") == act.get("subnet") and
                    exp.get("nexthop") == act.get("nexthop") and
                    exp.get("outgoing_interface") == act.get("outgoing_interface") and
                    exp.get("protocol") == act.get("protocol")):
                    found = True
                    break
            if found:
                matched.append(exp)
            else:
                unmatched.append(exp)

        results[host] = {
            "all_matched": (len(unmatched) == 0),
            "matched_entries": matched,
            "unmatched_entries": unmatched
        }

    return results