import React, { useState, useEffect } from 'react';
import './Popup.css';
import './Bar.css';
import './SwitchHost.css';
import './SwitchSwitch.css';
import './Lab.css'
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

  // Popup state for summary and result
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [summaryLinks, setSummaryLinks] = useState<SwitchToHostLink[]>([]);
  const [isResultPopupOpen, setIsResultPopupOpen] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  // New state to track result loading (similar to SwitchSwitch)
  const [isResultLoading, setIsResultLoading] = useState(false);

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

  // Submit all links to the backend to create playbook.
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

    console.log('Sending data to backend for playbook creation:', requestData);

    // Show summary popup immediately.
    setSummaryLinks([...links]);
    setIsPopupOpen(true);

    // Now send the configuration to the backend (for creating playbook).
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
          console.log('Playbook created:', data.playbook);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error submitting configuration:', err);
      });
  };

  // Updated: Handle Confirm to execute the playbook and show result popup with a loading state.
  const handleConfirm = () => {
    setError('');
    const requestData = links.map((link) => ({
      hostname: link.selectedHost,
      interfaces: link.interfaces.map((iface) => ({
        interface: iface.selectedInterface,
        vlanId: iface.vlanData.vlanId,
        ipAddress: iface.vlanData.ipAddress,
        subnetMask: iface.vlanData.subnetMask,
      })),
    }));

    console.log('Confirming configuration to backend:', requestData);

    setIsResultLoading(true);
    fetch('/api/run_playbook/swtohost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          console.log('Playbook executed:', data);
          setResultData(data);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error confirming configuration:', err);
      })
      .finally(() => {
        setIsResultLoading(false);
      });

    // Close the summary popup and open the result popup.
    setIsPopupOpen(false);
    setIsResultPopupOpen(true);
  };

  // Toggle the summary popup.
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
                          src="bin.png"
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
            <button className={`button-sw-sw-add ${loading ? 'loading' : ''}`} onClick={handleAddLink}>
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
          <button className="button-sw-sw-submit" onClick={handleSubmitAll}>
            Verify
          </button>
        </div>

        {/* Summary Popup */}
        {!error && isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup-content-host" style={{ width: "50%", maxHeight: "90%" }}>
              <h2>Summary</h2>
              {summaryLinks.length > 0 ? (
                <div style={{ maxHeight: "80%", overflowY: "auto", padding: "0px 20px" }}>
                  {summaryLinks.map((link, lIdx) => (
                    <>
                      <h4>{link.selectedHost || "Not Selected"}</h4>
                      <div key={lIdx} className="popup-table-wrapper" style={{ marginBottom: "20px" }}>

                        <table className="summary-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th>IP address</th>
                              <th>Outgoing Interface</th>
                              <th>VLAN ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {link.interfaces.map((iface, iIdx) => (
                              <tr key={`${lIdx}-${iIdx}`}>
                                <td>
                                  {iface.vlanData.ipAddress && iface.vlanData.subnetMask
                                    ? `${iface.vlanData.ipAddress}/${iface.vlanData.subnetMask}`
                                    : "Not Selected"}
                                </td>
                                <td>{iface.selectedInterface || "Not Selected"}</td>
                                <td>{iface.vlanData.vlanId || "Not Selected"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ))}
                </div>
              ) : (
                <p>No links created.</p>
              )}
              <div className="submit-sw-sw-container" style={{ marginRight: "0px" }}>
                <button className="button-swh-close" onClick={handleTogglePopup}>
                  Close
                </button>
                {/* Confirm now calls handleConfirm */}
                <button className="button-sw-sw-submit" onClick={handleConfirm}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result Popup with Loading */}
        {isResultPopupOpen && (
          <div className="popup-overlay">
            <div className="popup-preview">
              <h1>Result</h1>
              {isResultLoading ? (
                <div style={{ height: "100%" }}>
                  <div className="loading-container">
                    <div className="spinner-lab" />
                    <p>Loading...</p>
                  </div>
                </div>
              ) : resultData ? (
                <div className="result-content" style={{ height: "85%" }} >
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0px 10px", height: "97%" }}>
                    {/* Applied on device Section */}
                    <div
                      style={{
                        width: "48%",
                        backgroundColor: "#e6f7ff",
                        padding: "10px",
                        border: "1px solid #b3daff",
                        borderRadius: "5px",

                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>Applied on device:</h4>
                      <div
                        className="popup-table-section-result"
                        style={{ maxHeight: "65vh" }}
                      >
                        {resultData.comparison.map((sw: any, idx: number) => {
                          // Compute overall match status based on each interface's matched property
                          const deviceMatched = sw.interfaces.every((iface: any) => iface.matched);
                          return (
                            <div
                              key={idx}
                              className="popup-table"
                              style={{
                                marginBottom: "20px",
                                backgroundColor: "#ffffff",
                                borderRadius: "4px",
                                padding: "10px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <h5>
                                  {sw.hostname}
                                </h5>
                                <span
                                  style={{
                                    color: deviceMatched ? "green" : "red",
                                    marginLeft: "10px",
                                  }}
                                >
                                  {deviceMatched ? "Matched" : "Unmatched"}
                                </span>
                              </div>
                              <div className="popup-table-wrapper" style={{ overflowX: "auto" }}>
                                <table
                                  border={1}
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  <thead>
                                    <tr style={{ backgroundColor: "#f0f8ff" }}>
                                      <th>Interface</th>
                                      <th>IP Address</th>
                                      <th>VLAN ID</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sw.interfaces.map((iface: any, i: number) => (
                                      <tr key={i}>
                                        <td>{iface.parsed.interface}</td>
                                        <td>
                                          {iface.parsed.ip_address}/{iface.parsed.subnet_mask}
                                        </td>
                                        <td>{iface.parsed.vlan}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                    {/* Configuration sent Section */}
                    <div
                      style={{
                        width: "48%",
                        backgroundColor: "#fff9e6",
                        padding: "10px",
                        border: "1px solid #ffe6b3",
                        borderRadius: "5px",
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>Configuration sent:</h4>
                      <div
                        className="popup-table-section-result"
                        style={{ maxHeight: "65vh", overflowX: "auto" }}
                      >
                        {resultData.comparison.map((sw: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: "20px" }}>
                            <div
                              key={idx}
                              className="popup-table"
                              style={{
                                marginBottom: "20px",
                                backgroundColor: "#ffffff",
                                borderRadius: "4px",
                                padding: "10px",
                              }}
                            >
                              <h5>{sw.hostname}</h5>
                              <div className="popup-table-wrapper" style={{ overflowX: "auto" }}>
                                <table
                                  border={1}
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  <thead>
                                    <tr style={{ backgroundColor: "#fff2e6" }}>
                                      <th>Interface</th>
                                      <th>IP Address</th>
                                      <th>VLAN ID</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sw.interfaces.map((iface: any, i: number) => (
                                      <tr key={i}>
                                        <td>{iface.frontend.interface}</td>
                                        <td>
                                          {iface.frontend.ipAddress}/{iface.frontend.subnetMask}
                                        </td>
                                        <td>{iface.frontend.vlanId}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p>No result data available.</p>
              )}
              {!isResultLoading && (
                <div className="submit-sw-sw-container">
                  <button className="button-swh-close" onClick={() => setIsResultPopupOpen(false)}>
                    Close
                  </button>
                </div>
              )}
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
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SwitchHost;
