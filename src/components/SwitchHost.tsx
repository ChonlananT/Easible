import React, { useState, useEffect } from 'react';
import './Bar.css';
import './SwitchHost.css';
import './SwitchSwitch.css';
import Spinner from './bootstrapSpinner.tsx';
import { ArrowLeftFromLine, ChevronDown, Menu } from 'lucide-react';

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

type VlanData = {
  vlanId: string;
  ipAddress: string;
  subnetMask: string;
};

type SwitchToHostLink = {
  selectedHost: string;
  selectedInterface: string;
  vlanData: VlanData;
};

function SwitchHost() {
  const [hosts, setHosts] = useState<DropdownOption[]>([]);
  const [interfaceData, setInterfaceData] = useState<InterfaceData[]>([]);
  const [links, setLinks] = useState<SwitchToHostLink[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem('isNavOpen');
    return savedNavState === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isNavOpen', isNavOpen.toString());
  }, [isNavOpen]);

  // Fetch backend data
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
        // Use the second half of parsed_result
        const halfLength = Math.floor(data.parsed_result.length / 2);
        const secondHalf = data.parsed_result.slice(halfLength);
        setHosts(secondHalf);

        const iData = secondHalf.map((item: any) => ({
          hostname: item.hostname,
          interfaces: item.interfaces.map((interfaceItem: any) => ({
            interface: interfaceItem.interface,
            ip_address: interfaceItem.detail.ip_address,
            status: interfaceItem.detail.status,
          })),
          vlan_ids: item.vlan_ids || [],
        }));
        setInterfaceData(iData);

        // Initialize with one empty link
        setLinks([
          {
            selectedHost: '',
            selectedInterface: '',
            vlanData: {
              vlanId: '',
              ipAddress: '',
              subnetMask: '',
            },
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Get interfaces for the selected host
  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // Get VLAN IDs for the selected host from the hosts data
  const getVlanIdsForHost = (hostname: string): string[] => {
    const host = hosts.find((h) => h.hostname === hostname);
    return host && host.vlan_ids ? host.vlan_ids : [];
  };

  // Handler for changes in link fields
  const handleLinkChange = (
    linkIndex: number,
    field: 'selectedHost' | 'selectedInterface',
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
      // If host is changed, reset the interface and VLAN selection
      if (field === 'selectedHost') {
        newLinks[linkIndex].selectedInterface = '';
        newLinks[linkIndex].vlanData.vlanId = '';
      }
      return newLinks;
    });
  };

  // Handler for VLAN data changes
  const handleVlanChange = (
    linkIndex: number,
    field: keyof VlanData,
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex] = {
        ...newLinks[linkIndex],
        vlanData: { ...newLinks[linkIndex].vlanData, [field]: value },
      };
      return newLinks;
    });
  };

  // Add a new switch-to-host link
  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        selectedHost: '',
        selectedInterface: '',
        vlanData: {
          vlanId: '',
          ipAddress: '',
          subnetMask: '',
        },
      },
    ]);
  };

  // Remove a link
  const handleRemoveLink = (linkIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== linkIndex));
  };

  // Submit all links to the backend
  const handleSubmitAll = () => {
    setError('');

    // Validate that all links are filled
    for (let link of links) {
      if (
        !link.selectedHost ||
        !link.selectedInterface ||
        !link.vlanData.vlanId ||
        !link.vlanData.ipAddress ||
        !link.vlanData.subnetMask
      ) {
        setError(
          'Please select a host, an interface and fill in VLAN ID, IP address, and subnet mask for all links before submitting.'
        );
        return;
      }
    }

    const requestData = links.map((link) => ({
      hostname: link.selectedHost,
      interface: link.selectedInterface,
      vlanId: link.vlanData.vlanId,
      ipAddress: link.vlanData.ipAddress,
      subnetMask: link.vlanData.subnetMask,
    }));

    console.log('Sending data to backend:', requestData);

    fetch('/api/create_playbook_swtohost', {
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

  //popup
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [summaryLinks, setSummaryLinks] = useState<SwitchToHostLink[]>([]);

// Toggle the popup and store selected links
  const handleTogglePopup = () => {
    if (!isPopupOpen) {
      setSummaryLinks([...links]); // Save the current selected links to display in summary
    }
    setIsPopupOpen(!isPopupOpen);
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
            onMouseEnter={(e) =>
              (e.currentTarget as HTMLElement).style.color = '#8c94dc'
            }
            onMouseLeave={(e) =>
              (e.currentTarget as HTMLElement).style.color = 'black'
            }
          >
            <a>Configuration</a>
            <ChevronDown className={isNavDropdownOpen ? "chevron-nav rotated" : "chevron-nav"}/>
          </li>
          <ul className={`nav-dropdown ${isNavDropdownOpen ? 'open' : ''}`}>
            <li className="center sub-topic">
              <a href="/routerrouter">router-router</a>
            </li>
            <li className="center sub-topic">
              <a href="/routerswitch">router-switch</a>
            </li>
            <li className="center sub-topic">
              <a href="/switchswitch">switch-switch</a>
            </li>
            <li className="center sub-topic">
              <a href="/switchhost" style={{ color: '#8c94dc' }}>
                switch-host
              </a>
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
          Configuration <span className="content-topic-small">(Switch-Host)</span>
        </div>
        <div className="content-board">
          <div className="all-links-swh">
            {links.map((link, index) => (
              <div key={index} className="switch-switch">
                <div className="top-link">
                  <div className="link-index">Link {index + 1}</div>
                  <div className="remove-link-container">
                    {links.length > 1 && (
                      <button
                        onClick={() => handleRemoveLink(index)}
                        className="button-sw-sw-remove"
                      >
                        <img
                          src="bin.png" // Replace with your actual image path
                          alt="Remove link"
                          style={{ width: '45px', height: '27px' }}
                        />
                      </button>
                    )}
                  </div>
                </div>

                <div className="content-section-swh">
                  <div
                    className={`host-selection-container-swh ${
                      link.selectedHost ? "move-left" : ""
                    }`}
                  >
                    <div className="host-selection__hosts-swh">
                      <div className="host-swh">
                        <div className="host-card">
                          <div className="host-selection__dropdown-group">
                            <label>Select Host (Switch):</label>
                            <div className="host-selection__dropdown-container">
                              <select
                                className="host-selection__dropdown"
                                onChange={(e) =>
                                  handleLinkChange(index, "selectedHost", e.target.value)
                                }
                                value={link.selectedHost}
                              >
                                <option value="">-- Select a Host --</option>
                                <option value="test">test</option>
                                {!loading &&
                                  hosts.map((host) => (
                                    <option key={host.hostname} value={host.hostname}>
                                      {host.hostname}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Show interface and VLAN selection once a host is selected */}
                  {link.selectedHost && (
                    <div className="command-section-swh">
                      <div className="host-selection__dropdown-swh">
                        <label>Select Interface for {link.selectedHost}:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.selectedInterface}
                          onChange={(e) =>
                            handleLinkChange(index, "selectedInterface", e.target.value)
                          }
                        >
                          <option value="">-- Select Interface --</option>
                          <option value="1/0/1">-- interface --</option>
                          {getInterfacesForHost(link.selectedHost).map((intf) => (
                            <option key={intf.interface} value={intf.interface}>
                              {intf.interface} ({intf.status})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* VLAN Configuration Section */}
                      <div className="host-selection__vlan-configuration-swh">
                        <div className="input-sw-sw-group">
                          <label>VLAN ID:</label>
                          <select
                            className="host-selection__dropdown"
                            value={link.vlanData.vlanId}
                            onChange={(e) =>
                              handleVlanChange(index, "vlanId", e.target.value)
                            }
                          >
                            <option value="">-- Select VLAN --</option>
                            <option value="400">-- 400 --</option>
                            {getVlanIdsForHost(link.selectedHost).map((vlan) => (
                              <option key={vlan} value={vlan}>
                                {vlan}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="input-sw-sw-group">
                          <label>IP Address:</label>
                          <input
                            type="text"
                            value={link.vlanData.ipAddress}
                            onChange={(e) =>
                              handleVlanChange(index, "ipAddress", e.target.value)
                            }
                            placeholder="Enter IP Address"
                            className="input-sw-sw"
                          />
                        </div>
                        <div className="input-sw-sw-group">
                          <label>Subnet Mask (CIDR):</label>
                          <input
                            type="number"
                            min={1}
                            max={32}
                            value={link.vlanData.subnetMask}
                            onChange={(e) =>
                              handleVlanChange(index, "subnetMask", e.target.value)
                            }
                            placeholder="Enter Subnet Mask"
                            className="input-sw-sw"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="line-container">
            <div className="line"></div>
            <button
              onClick={handleAddLink}
              className={`button-sw-sw-add ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <>
                  <Spinner color="white" size="small" />
                  <span className="fetching-text">Fetching Data...</span>
                </>
              ) : (
                "+ Add Switch-Host Link"
              )}
            </button>
            <div className="line"></div>
          </div>
        </div>

        <div className="submit-sw-sw-container">
          <button className="button-sw-sw-submit" onClick={handleTogglePopup}>
            Check
          </button>
          <button className="button-sw-sw-submit" onClick={handleSubmitAll}>
            Submit All
          </button>
        </div>

        {isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup-content-swh">
              <h2>Summary</h2>
              {summaryLinks.length > 0 ? (
                <div className='popup-table-wrapper'>
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th>Switch</th>
                        <th>Outgoing Interface</th>
                        <th>VLAN ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryLinks.map((link, index) => (
                        <tr key={index}>
                          <td>{link.selectedHost || "Not Selected"}</td>
                          <td>{link.selectedInterface || "Not Selected"}</td>
                          <td>{link.vlanData.vlanId || "Not Selected"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No links created.</p>
              )}
              <div className="submit-sw-sw-container" style={{ marginTop: '15px' }}>
                <button className="button-swh-close" onClick={handleTogglePopup}>
                  Close
                </button>
                <button className="button-sw-sw-submit" onClick={handleSubmitAll}>
                  Submit All
                </button>
              </div>
            </div>
          </div>
        )}


        {error && <div className="error-sw-sw">Error: {error}</div>}
      </div>
    </div>
  );
}

export default SwitchHost;
