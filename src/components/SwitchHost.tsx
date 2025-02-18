import React, { useState, useEffect } from 'react';
import './Bar.css';
import './SwitchHost.css';
import './SwitchSwitch.css';
import Spinner from './bootstrapSpinner.tsx';
import { ArrowLeftFromLine, ChevronDown, CircleMinus, Menu } from 'lucide-react';
import Navbar from "./Navbar.tsx";

// Types for host and interface information
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

// Each interface configuration within a link
type InterfaceConfig = {
  selectedInterface: string;
  vlanData: VlanData;
};

// A link now contains one selected host and an array of interface configurations.
type SwitchToHostLink = {
  selectedHost: string;
  interfaces: InterfaceConfig[];
};

function SwitchHost() {
  const [hosts, setHosts] = useState<DropdownOption[]>([]);
  const [interfaceData, setInterfaceData] = useState<InterfaceData[]>([]);
  const [links, setLinks] = useState<SwitchToHostLink[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  // Navigation state
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
        // Use the returned parsed_result for hosts
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

        // Initialize with one empty link having one interface configuration
        setLinks([
          {
            selectedHost: '',
            interfaces: [
              {
                selectedInterface: '',
                vlanData: {
                  vlanId: '',
                  ipAddress: '',
                  subnetMask: '',
                },
              },
            ],
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Get interfaces for a given host.
  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // Get VLAN IDs for a given host.
  const getVlanIdsForHost = (hostname: string): string[] => {
    const host = hosts.find((h) => h.hostname === hostname);
    return host && host.vlan_ids ? host.vlan_ids : [];
  };

  // Handle changes in the host selection for a link.
  const handleLinkHostChange = (linkIndex: number, value: string) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const link = { ...newLinks[linkIndex] };
      link.selectedHost = value;
      // Reset all interface configurations if host changes.
      link.interfaces = [
        {
          selectedInterface: '',
          vlanData: { vlanId: '', ipAddress: '', subnetMask: '' },
        },
      ];
      newLinks[linkIndex] = link;
      return newLinks;
    });
  };

  // Handle changes in an interface configuration for a link.
  const handleInterfaceChange = (
    linkIndex: number,
    interfaceIndex: number,
    field: 'selectedInterface',
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const iface = { ...newLinks[linkIndex].interfaces[interfaceIndex] };
      iface.selectedInterface = value;
      newLinks[linkIndex].interfaces[interfaceIndex] = iface;
      return newLinks;
    });
  };

  // Handle changes in VLAN data for a specific interface config.
  const handleVlanChange = (
    linkIndex: number,
    interfaceIndex: number,
    field: keyof VlanData,
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const iface = { ...newLinks[linkIndex].interfaces[interfaceIndex] };
      iface.vlanData = { ...iface.vlanData, [field]: value };
      newLinks[linkIndex].interfaces[interfaceIndex] = iface;
      return newLinks;
    });
  };

  // Add a new interface configuration to a link.
  const handleAddInterface = (linkIndex: number) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].interfaces.push({
        selectedInterface: '',
        vlanData: { vlanId: '', ipAddress: '', subnetMask: '' },
      });
      return newLinks;
    });
  };

  // Remove an interface configuration from a link.
  const handleRemoveInterface = (linkIndex: number, interfaceIndex: number) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      // Only remove if there is more than one interface configuration.
      if (newLinks[linkIndex].interfaces.length > 1) {
        newLinks[linkIndex].interfaces = newLinks[linkIndex].interfaces.filter(
          (_, idx) => idx !== interfaceIndex
        );
      }
      return newLinks;
    });
  };

  // Add a new switch-to-host link.
  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        selectedHost: '',
        interfaces: [
          {
            selectedInterface: '',
            vlanData: { vlanId: '', ipAddress: '', subnetMask: '' },
          },
        ],
      },
    ]);
  };

  // Remove a link.
  const handleRemoveLink = (linkIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== linkIndex));
  };

  // Submit all links to the backend.
  const handleSubmitAll = () => {
    setError('');
    // Validate each link and each interface config
    for (let link of links) {
      if (!link.selectedHost) {
        setError('Please select a host for all links before submitting.');
        return;
      }
      for (let iface of link.interfaces) {
        if (
          !iface.selectedInterface ||
          !iface.vlanData.vlanId ||
          !iface.vlanData.ipAddress ||
          !iface.vlanData.subnetMask
        ) {
          setError(
            'Please fill in all interface fields (interface, VLAN ID, IP address, and subnet mask) for all links.'
          );
          return;
        }
      }
    }

    // Prepare request data.
    const requestData = links.map((link) => ({
      hostname: link.selectedHost,
      interfaces: link.interfaces.map((iface) => ({
        interface: iface.selectedInterface,
        vlanId: iface.vlanData.vlanId,
        ipAddress: iface.vlanData.ipAddress,
        subnetMask: iface.vlanData.subnetMask,
      })),
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

  // Popup state for summary
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [summaryLinks, setSummaryLinks] = useState<SwitchToHostLink[]>([]);

  // Toggle the popup and store selected links
  const handleTogglePopup = () => {
    if (!isPopupOpen) {
      setSummaryLinks([...links]);
    }
    setIsPopupOpen(!isPopupOpen);
  };

  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () => {
    setIsNavDropdownOpen(!isNavDropdownOpen);
  };

  const [showPopup, setShowPopup] = useState(false);

  return (
    <div className="App">
      <Navbar isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} />
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
            {links.map((link, linkIndex) => (
              <div key={linkIndex} className="switch-switch">
                <div className="top-link">
                  <div className="link-index">Link {linkIndex + 1}</div>
                  <div className="remove-link-container">
                    {links.length > 1 && (
                      <button onClick={() => handleRemoveLink(linkIndex)} className="button-sw-sw-remove">
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
                  <div className={`host-selection-container-swh ${link.selectedHost ? "move-left" : ""}`}>
                    <div className="host-selection__hosts-swh">
                      <div className="host-swh">
                        <div className="host-card">
                          <div className="host-selection__dropdown-group">
                            <label>Select Host (Switch):</label>
                            <div className="host-selection__dropdown-container">
                              <select
                                className="host-selection__dropdown"
                                onChange={(e) =>
                                  handleLinkHostChange(linkIndex, e.target.value)
                                }
                                value={link.selectedHost}
                              >
                                <option value="">-- Select a Host --</option>
                                {/* Optionally include a test option */}
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

                    {link.selectedHost && (
                      <div className="command-section-swh">
                        {/* Loop through each interface configuration for this link */}
                        {link.interfaces.map((iface, ifaceIndex) => (

                          <div key={ifaceIndex} className="interface-config-swh">
                            <div className="interface-selection__vlan-configuration-swh">
                              <div className="host-selection__dropdown-swh">
                                <label>Select Interface for {link.selectedHost}:</label>
                                <select
                                  className="host-selection__dropdown"
                                  value={iface.selectedInterface}
                                  onChange={(e) =>
                                    handleInterfaceChange(linkIndex, ifaceIndex, "selectedInterface", e.target.value)
                                  }
                                >
                                  <option value="">-- Select Interface --</option>
                                  {getInterfacesForHost(link.selectedHost).map((intf) => (
                                    <option key={intf.interface} value={intf.interface}>
                                      {intf.interface} ({intf.status})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="host-selection__vlan-configuration-swh">
                              <div className="input-sw-sw-group">
                                <label>VLAN ID:</label>
                                <select
                                  className="host-selection__dropdown-vlan"
                                  value={iface.vlanData.vlanId}
                                  onChange={(e) =>
                                    handleVlanChange(linkIndex, ifaceIndex, "vlanId", e.target.value)
                                  }
                                >
                                  <option value="">-- Select VLAN --</option>
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
                                  value={iface.vlanData.ipAddress}
                                  onChange={(e) =>
                                    handleVlanChange(linkIndex, ifaceIndex, "ipAddress", e.target.value)
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
                                  value={iface.vlanData.subnetMask}
                                  onChange={(e) =>
                                    handleVlanChange(linkIndex, ifaceIndex, "subnetMask", e.target.value)
                                  }
                                  placeholder="Enter Subnet Mask"
                                  className="input-sw-sw"
                                />
                              </div>
                            </div>
                            {link.interfaces.length > 1 && (
                              <div>
                                <CircleMinus style={{ width: '30px', height: '30px', color: 'red', marginTop: '55px', marginLeft: '10px', cursor: 'pointer' }} onClick={() => handleRemoveInterface(linkIndex, ifaceIndex)} />
                              </div>
                            )}
                          </div>
                        ))}
                        <span />
                        <button className="button-add-interface" onClick={() => handleAddInterface(linkIndex)}>
                          + Add Interface
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

        {!error && isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup-content-swh">
              <h2>Summary</h2>
              {summaryLinks.length > 0 ? (
                <div className="popup-table-wrapper">
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th>Switch</th>
                        <th>Outgoing Interface</th>
                        <th>VLAN ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryLinks.map((link, lIdx) =>
                        link.interfaces.map((iface, iIdx) => (
                          <tr key={`${lIdx}-${iIdx}`}>
                            <td>{link.selectedHost || "Not Selected"}</td>
                            <td>{iface.selectedInterface || "Not Selected"}</td>
                            <td>{iface.vlanData.vlanId || "Not Selected"}</td>
                          </tr>
                        ))
                      )}
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

        {error && (
          <div className="popup-overlay">
            <div className="popup-content-host">
              <div className="error-rt-rt">{error}</div>
              <button
                className="cancel-btn"
                onClick={() => {
                  setError("");
                  setShowPopup(false);
                }}
              >
                close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SwitchHost;
