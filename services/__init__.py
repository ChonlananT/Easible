from services.database import get_connection, fetch_all_devices, add_device, delete_device
from services.parse import parse_interface,parse_result,parse_configd_switch
from services.stp_calculating_services import recalc_stp
from services.compare_router_switch import compare_router_switch
from services.compare_config_device import compare_config_device