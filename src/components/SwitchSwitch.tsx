import React, { useState, useEffect } from 'react';
import './Bar.css';
import './SwitchSwitch.css';
import Spinner from './bootstrapSpinner.tsx';
import { ArrowLeftFromLine, ChevronDown, CircleMinus, Menu } from 'lucide-react';

type DropdownOption = {
  hostname: string;
  interfaces: {
    details: {
      ip_address: string;
      status: string;
    };
    interface: string;
  }[];
  vlan_ids?: string[];
};

type InterfaceData = {
  hostname: string;
  interfaces: {
    interface: string;
    ip_address: string;
    status: string;
  }[];
  vlan_ids?: string[];
};

// Updated LinkConfig: no command field; includes a list for multiple VLANs.
type LinkConfig = {
  selectedHost1: string;
  selectedHost2: string;
  selectedInterface1: string;
  selectedInterface2: string;
  switchportMode: string;
  vlans: string[]; // List of selected VLAN IDs
};

function SwitchSwitch() {
  const [hosts, setHosts] = useState<DropdownOption[]>([]);
  const [interfaceData, setInterfaceData] = useState<InterfaceData[]>([]);
  const [links, setLinks] = useState<LinkConfig[]>([]);
  const [vlans, setVlans] = useState<{ [key: string]: string[] }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem('isNavOpen');
    return savedNavState === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isNavOpen', isNavOpen.toString());
  }, [isNavOpen]);

  // Fetch data from backend
  useEffect(() => {
    setLoading(true);
    fetch('/api/show_detail_switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHosts(data.parsed_result);

        const iData = data.parsed_result.map((item: any) => ({
          hostname: item.hostname,
          interfaces: item.interfaces.map((interfaceItem: any) => ({
            interface: interfaceItem.interface,
            ip_address: interfaceItem.detail.ip_address,
            status: interfaceItem.detail.status,
          })),
          vlan_ids: item.vlan_ids || [],
        }));
        setInterfaceData(iData);

        // Build a dictionary of VLANs per host.
        const tempVlans: { [key: string]: string[] } = {};
        data.parsed_result.forEach((host: any) => {
          tempVlans[host.hostname] = host.vlan_ids || [];
        });
        setVlans(tempVlans);

        // Initialize with one empty link.
        setLinks([
          {
            selectedHost1: '',
            selectedHost2: '',
            selectedInterface1: '',
            selectedInterface2: '',
            switchportMode: '',
            vlans: [],
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // When a host is changed, update the link and clear related fields.
  const handleHostChange = (
    linkIndex: number,
    whichHost: 'selectedHost1' | 'selectedHost2',
    hostValue: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const link = { ...newLinks[linkIndex] };
      link[whichHost] = hostValue;
      // Clear interface selections and VLANs when host changes.
      if (whichHost === 'selectedHost1') {
        link.selectedInterface1 = '';
      } else {
        link.selectedInterface2 = '';
      }
      link.vlans = [];
      newLinks[linkIndex] = link;
      return newLinks;
    });
  };

  // Handle changes in fields for a link (other than VLANs)
  const handleLinkChange = (
    linkIndex: number,
    field: keyof Omit<LinkConfig, 'vlans'>,
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
      // If switchport mode changes to "access", clear any VLAN selections.
      if (field === 'switchportMode' && value === 'access') {
        newLinks[linkIndex].vlans = [];
      }
      return newLinks;
    });
  };

  // Get interfaces for a given host.
  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // Compute common VLANs between the two selected hosts.
  const getCommonVlans = (link: LinkConfig): string[] => {
    if (link.selectedHost1 && link.selectedHost2) {
      const vlans1 = vlans[link.selectedHost1] || [];
      const vlans2 = vlans[link.selectedHost2] || [];
      return vlans1.filter((vlan) => vlans2.includes(vlan));
    }
    return [];
  };

  // Handle adding a new VLAN selection to a link.
  const handleAddVlan = (linkIndex: number) => {
    // Only allow adding VLANs if switchport mode is "trunk"
    if (links[linkIndex].switchportMode !== 'trunk') return;
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlans.push('');
      return newLinks;
    });
  };

  // Handle changing a VLAN selection value in a link.
  const handleVlanChange = (linkIndex: number, vlanIndex: number, value: string) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlans[vlanIndex] = value;
      return newLinks;
    });
  };

  // Handle removing a VLAN selection.
  const handleRemoveVlan = (linkIndex: number, vlanIndex: number) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlans = newLinks[linkIndex].vlans.filter((_, idx) => idx !== vlanIndex);
      return newLinks;
    });
  };

  // Add a new link.
  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        selectedHost1: '',
        selectedHost2: '',
        selectedInterface1: '',
        selectedInterface2: '',
        switchportMode: '',
        vlans: [],
      },
    ]);
  };

  // Remove a link.
  const handleRemoveLink = (linkIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== linkIndex));
  };

  // Submit configuration data.
  const handleSubmitAll = () => {
    setError('');

    // Validate required fields for each link.
    for (let link of links) {
      if (
        !link.selectedHost1 ||
        !link.selectedHost2 ||
        !link.selectedInterface1 ||
        !link.selectedInterface2 ||
        !link.switchportMode
      ) {
        setError('Please select both hosts, interfaces, and switchport mode for all links before submitting.');
        return;
      }
    }

    const requestData = links.map((link) => ({
      hostname1: link.selectedHost1,
      hostname2: link.selectedHost2,
      interface1: link.selectedInterface1,
      interface2: link.selectedInterface2,
      switchportMode: link.switchportMode,
      vlans: link.vlans.filter((vlan) => vlan !== ''), // filter out any empty values
    }));

    console.log('Sending data to backend:', requestData);

    fetch('/api/create_playbook_swtosw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          alert('Configuration submitted successfully!');
          console.log('Playbook created:', data.playbook);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error submitting configuration:', err);
      });
  };

  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () => {
    setIsNavDropdownOpen(!isNavDropdownOpen);
  };

  return (
    <div className="App">
      <div className={`nav-links-container ${isNavOpen ? '' : 'closed'}`}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            paddingRight: '10px',
            paddingTop: '10px',
          }}
        >
          <button
            style={{
              marginBottom: '16px',
              padding: '8px',
              color: '#7b7b7b',
              borderRadius: '8px',
              zIndex: 50,
              border: 'none',
              background: '#f5f7f9',
            }}
            onClick={() => setIsNavOpen(false)}
          >
            <ArrowLeftFromLine size={24} />
          </button>
          <img src="/easible-name.png" alt="" className="dashboard-icon" />
        </div>
        <ul className="nav-links">
          <li className="center">
            <a href="/dashboard">Dashboard</a>
          </li>
          <li className="center">
            <a href="/hosts">Devices</a>
          </li>
          <li
            className="center"
            onClick={toggleNavDropdown}
            style={{ cursor: 'pointer', color: 'black' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#8c94dc')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'black')}
          >
            <a>Configuration </a>
            <ChevronDown className={isNavDropdownOpen ? 'chevron-nav rotated' : 'chevron-nav'} />
          </li>
          <ul className={`nav-dropdown ${isNavDropdownOpen ? 'open' : ''}`}>
            <li className="center sub-topic">
              <a href="/routerrouter">router-router</a>
            </li>
            <li className="center sub-topic">
              <a href="/routerswitch">router-switch</a>
            </li>
            <li className="center sub-topic">
              <a href="/switchswitch" style={{ color: '#8c94dc' }}>
                switch-switch
              </a>
            </li>
            <li className="center sub-topic">
              <a href="/switchhost">switch-host</a>
            </li>
            <li className="center sub-topic">
              <a href="/configdevice">config device</a>
            </li>
          </ul>
          <li className="center">
            <a href="/lab">Lab Check</a>
          </li>
        </ul>
      </div>

      <div className={`content ${isNavOpen ? 'expanded' : 'full-width'}`}>
        <div className="content-topic">
          {!isNavOpen && (
            <button
              style={{
                padding: '8px',
                color: 'black',
                borderRadius: '8px',
                zIndex: 50,
                border: 'none',
                background: 'white',
                marginRight: '8px',
              }}
              onClick={() => setIsNavOpen(true)}
            >
              <Menu size={24} />
            </button>
          )}
          Configuration <span className="content-topic-small">(Switch-Switch)</span>
        </div>
        <div className="content-board">
          <div className="all-links">
            {links.map((link, index) => {
              // Compute common VLANs for the selected hosts.
              const commonVlans = getCommonVlans(link);
              // Filter out VLANs that have already been selected in this link.
              const selectedVlans = link.vlans.filter((v) => v);
              const availableVlans = commonVlans.filter((vlan) => !selectedVlans.includes(vlan));

              return (
                <div key={index} className="switch-switch">
                  <div className="top-link">
                    <div className="link-index">Link {index + 1}</div>
                    <div className="remove-link-container">
                      {links.length > 1 && (
                        <button onClick={() => handleRemoveLink(index)} className="button-sw-sw-remove">
                          <img
                            src="bin.png" // Replace with your actual image path
                            alt="Remove link"
                            style={{ width: '45px', height: '27px' }}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="content-section">
                    <div className="host-selection-container">
                      <div className="host-selection__hosts">
                        <div className="host-sw-sw">
                          <div className="host-card">
                            <div className="host-selection__dropdown-group">
                              <label>Select Host (SW1):</label>
                              <div className="host-selection__dropdown-container">
                                <select
                                  className="host-selection__dropdown"
                                  onChange={(e) => handleHostChange(index, 'selectedHost1', e.target.value)}
                                  value={link.selectedHost1}
                                >
                                  <option value="">-- Select a Host --</option>
                                  {hosts.map((host: DropdownOption) => (
                                    <option key={host.hostname} value={host.hostname}>
                                      {host.hostname}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="host-selection__dropdown-group">
                              <label>Select Interface for {link.selectedHost1}:</label>
                              <div className="host-selection__dropdown-container">
                                <select
                                  className="host-selection__dropdown"
                                  value={link.selectedInterface1}
                                  onChange={(e) => handleLinkChange(index, 'selectedInterface1', e.target.value)}
                                >
                                  <option value="">-- Select Interface --</option>
                                  {getInterfacesForHost(link.selectedHost1).map((intf) => (
                                    <option key={intf.interface} value={intf.interface}>
                                      {intf.interface} ({intf.status})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="connect-pic-sw-sw">
                          <img
                            src="connect.png" // Replace with your actual image path
                            alt="Connect"
                            style={{ width: '150px', height: '100px' }}
                          />
                        </div>

                          <div className="host-sw-sw">
                            <div className="host-card">
                              <div className="host-selection__dropdown-group">
                                <label>Select Host (SW2):</label>
                                <div className="host-selection__dropdown-container">
                                  <select
                                    className="host-selection__dropdown"
                                    onChange={(e) => handleHostChange(index, 'selectedHost2', e.target.value)}
                                    value={link.selectedHost2}
                                  >
                                    <option value="">-- Select a Host --</option>
                                    {hosts.map((host: DropdownOption) => (
                                      <option key={host.hostname} value={host.hostname}>
                                        {host.hostname}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="host-selection__dropdown-group">
                                <label>Select Interface for {link.selectedHost2}:</label>
                                <div className="host-selection__dropdown-container">
                                  <select
                                    className="host-selection__dropdown"
                                    value={link.selectedInterface2}
                                    onChange={(e) => handleLinkChange(index, 'selectedInterface2', e.target.value)}
                                  >
                                    <option value="">-- Select Interface --</option>
                                    {getInterfacesForHost(link.selectedHost2).map((intf) => (
                                      <option key={intf.interface} value={intf.interface}>
                                        {intf.interface} ({intf.status})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                        </div>
                      </div>

                      {/* Fixed Switchport configuration */}
                      <div className="host-selection__switchport-configuration">
                        <div className="host-selection__dropdown-group">
                          <h5 style={{textAlign: 'center'}}>Switchport Mode:</h5>
                          <div className="host-selection__dropdown-container">
                            <select
                              className="host-selection__dropdown"
                              value={link.switchportMode}
                              onChange={(e) => handleLinkChange(index, 'switchportMode', e.target.value)}
                            >
                              <option value="">-- Select Mode --</option>
                              <option value="trunk">Trunk</option>
                              <option value="access">Access</option>
                            </select>
                          </div>
                        </div>

                        {/* VLAN selection section is only shown for trunk mode */}
                        {link.switchportMode === 'trunk' && (
                          <div className="host-selection__vlan-multiple">
                            <h5 style={{textAlign: 'center'}}>Add VLAN(s):</h5>
                            {link.vlans.map((vlan, vlanIndex) => (
                              <div key={vlanIndex} className="vlan-selection-group">
                                <select
                                  className="host-selection__dropdown"
                                  value={vlan}
                                  onChange={(e) => handleVlanChange(index, vlanIndex, e.target.value)}
                                >
                                  <option value="">-- Select VLAN --</option>
                                  {availableVlans.map((vlanOption) => (
                                    <option key={vlanOption} value={vlanOption}>
                                      {vlanOption}
                                    </option>
                                  ))}
                                </select>
                                <CircleMinus style={{ width: '25px', height: '25px', color: 'red', marginTop:'20px', marginLeft:'5px', cursor: 'pointer'}}
                                  onClick={() => handleRemoveVlan(index, vlanIndex)}
                                >
                                  Remove
                                </CircleMinus>
                              </div>
                            ))}
                            <button className="button-add-vlan" style={{ marginTop: '10px' }} onClick={() => handleAddVlan(index)}>
                              + Add VLAN
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="line-container">
            <div className="line"></div>
            <button onClick={handleAddLink} className={`button-sw-sw-add ${loading ? 'loading' : ''}`}>
              {loading ? (
                <>
                  <Spinner color="white" size="small" />
                  <span className="fetching-text">Fetching Data...</span>
                </>
              ) : (
                "+ Add Switch-Switch Link"
              )}
            </button>
            <div className="line"></div>
          </div>
        </div>
        <div className="submit-sw-sw-container">
          <button className="button-sw-sw-submit" onClick={handleSubmitAll}>
            Submit All
          </button>
        </div>
        {error && <div className="error-sw-sw">Error: {error}</div>}
      </div>
    </div>
  );
}

export default SwitchSwitch;
