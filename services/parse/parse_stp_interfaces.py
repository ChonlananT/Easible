import re
import json

# ----------------------------------------------------------------
# Updated regex to capture interface lines for:
#   - GigabitEthernet (Gi, Gig)
#   - FastEthernet (Fa, Fast)
#   - TenGigabitEthernet (Te, TenGig)
#   - TwentyFiveGigabitEthernet (Twe, TwentyFiveGig, TwentyFiveGigE)
# ----------------------------------------------------------------
stp_interface_pattern = re.compile(
    r'^(?P<intf>(?:(?:GigabitEthernet)|(?:Gig)|(?:Gi)|'
    r'(?:FastEthernet)|(?:Fast)|(?:Fa)|'
    r'(?:TenGigabitEthernet)|(?:TenGig)|(?:Te)|'
    r'(?:TwentyFiveGigabitEthernet)|(?:TwentyFiveGig)|(?:TwentyFiveGigE)|(?:Twe))\S+)\s+'
    r'(?P<role>\S+)\s+\S+\s+(?P<cost>\d+)',
    re.MULTILINE
)

# ----------------------------------------------------------------
# Sample output text containing two VLAN blocks with STP information.
# Each VLAN block includes an interface table that lists different interface types.
# ----------------------------------------------------------------
sample_interface_text = r"""
ok: [SW401] => { "msg": [
VLAN0001
  Spanning tree enabled protocol ieee
  Root ID    Priority    32769
             Address     0c11.678c.8700
             This bridge is the root

  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)
             Address     0c11.678c.8700
             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec
             Aging Time  15  sec

Interface           Role Sts Cost      Prio.Nbr Type
------------------- ---- --- --------- -------- --------------------------------
Gi1/0/4             Desg FWD 4         128.4    P2p 
Gi1/0/7             Desg FWD 4         128.7    P2p 

VLAN0010
  Spanning tree enabled protocol ieee
  Root ID    Priority    32769
             Address     aabb.ccdd.eeff
             
  Bridge ID  Priority    32769  (priority 32768 sys-id-ext 1)
             Address     bbcc.ddee.ff00

Interface           Role Sts Cost      Prio.Nbr Type
------------------- ---- --- --------- -------- -------------------------------- 
Gi1/0/10            Desg FWD 8         130.4    P2p 
Gi1/0/11            Desg FWD 8         130.7    P2p 
]}
"""

def test_stp_interface_regex(text):
    """
    Search the entire text for lines matching the STP interface pattern.
    This version will capture lines starting with any of the supported interface types.
    """
    matches = []
    for match in stp_interface_pattern.finditer(text):
        matches.append(match.groupdict())
    return matches


