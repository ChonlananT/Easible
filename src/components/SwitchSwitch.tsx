import React, { useState, useEffect } from 'react';
import './Bar.css';
import './SwitchSwitch.css';
import Spinner from './bootstrapSpinner.tsx';
import { ArrowLeftFromLine, ChevronDown, CircleMinus, Menu, RefreshCcw } from 'lucide-react';
import Navbar from "./Navbar.tsx";
import "./Lab.css"
import SwitchNetworkTopology from './NetworkTopology(SW).tsx';

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
  const [backendResult, setBackendResult] = useState<any>(null); // result from backend
  const [isResultLoading, setIsResultLoading] = useState(false); // New state for result loading
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  const [showDetails, setShowDetails] = useState<any>(null);

  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem('isNavOpen');
    return savedNavState === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isNavOpen', isNavOpen.toString());
  }, [isNavOpen]);

  // Fetch data from backend
  const fetchSwitch = () => {
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
            switchportMode: 'trunk',
            vlans: [],
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    fetchSwitch();
  }, []);

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

  const handleLinkChange = (
    linkIndex: number,
    field: keyof Omit<LinkConfig, 'vlans'>,
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
      if (field === 'switchportMode' && value === 'access') {
        newLinks[linkIndex].vlans = [];
      }
      return newLinks;
    });
  };

  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  const getCommonVlans = (link: LinkConfig): string[] => {
    if (link.selectedHost1 && link.selectedHost2) {
      const vlans1 = vlans[link.selectedHost1] || [];
      const vlans2 = vlans[link.selectedHost2] || [];
      return vlans1.filter((vlan) => vlans2.includes(vlan));
    }
    return [];
  };

  const handleAddVlan = (linkIndex: number) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlans.push('');
      return newLinks;
    });
  };

  const handleVlanChange = (linkIndex: number, vlanIndex: number, value: string) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlans[vlanIndex] = value;
      return newLinks;
    });
  };

  const handleRemoveVlan = (linkIndex: number, vlanIndex: number) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlans = newLinks[linkIndex].vlans.filter((_, idx) => idx !== vlanIndex);
      return newLinks;
    });
  };

  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        selectedHost1: '',
        selectedHost2: '',
        selectedInterface1: '',
        selectedInterface2: '',
        switchportMode: 'trunk',
        vlans: [],
      },
    ]);
  };

  const handleRemoveLink = (linkIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== linkIndex));
  };

  const [isShowPopup, setIsShowPopup] = useState(false);
  const TogglePopup = () => setIsShowPopup(!isShowPopup);

  // Updated handleConfirm with a loading state for backend result.
  const handleConfirm = () => {
    setError('');
    for (let link of links) {
      if (
        !link.selectedHost1 ||
        !link.selectedHost2 ||
        !link.selectedInterface1 ||
        !link.selectedInterface2
      ) {
        setError('Please select both hosts and interfaces for all links before submitting.');
        return;
      }
    }
    const requestData = links.map((link) => ({
      hostname1: link.selectedHost1,
      hostname2: link.selectedHost2,
      interface1: link.selectedInterface1,
      interface2: link.selectedInterface2,
      vlans: link.vlans.filter((vlan) => vlan !== ''),
    }));

    setIsResultLoading(true); // start result loading

    fetch('/api/run_playbook/swtosw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setBackendResult(data);
          setShowDetails(data.detail);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error submitting configuration:', err);
      })
      .finally(() => {
        setIsResultLoading(false); // stop loading regardless of result
      });
  };

  const handleSubmitAll = () => {
    setError('');
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
    setBackendResult(null);

    const requestData = links.map((link) => ({
      hostname1: link.selectedHost1,
      hostname2: link.selectedHost2,
      interface1: link.selectedInterface1,
      interface2: link.selectedInterface2,
      switchportMode: link.switchportMode,
      vlans: link.vlans.filter((vlan) => vlan !== ''),
    }));



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
          console.log("Created Playbook");
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error submitting configuration:', err);
      });

    TogglePopup();
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
        <div className="content-topic" style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
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
          <button
            onClick={fetchSwitch}
            style={{
              display: "flex",
              fontSize: "16px",
              gap: "10px",
              alignItems: "center",
              paddingRight: "50px",
              paddingTop: "20px",
              border: "none",
              background: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
            disabled={loading}
            className="button-refresh"
          >
            <RefreshCcw /> Refresh
          </button>
        </div>
        <div className="content-board">
          {!loading && (
            <div className="all-links">
              {links.map((link, index) => {
                const commonVlans = getCommonVlans(link);
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
                              src="bin.png"
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
                                    {hosts
                                      .filter((host) => host.hostname !== link.selectedHost2)
                                      .map((host) => (
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
                                    {getInterfacesForHost(link.selectedHost1)
                                      .filter((intf) => !intf.interface.toLowerCase().includes('vlan'))
                                      .map((intf) => (
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
                              src="connect.png"
                              alt="Connect"
                              style={{ width: '150px', height: '100px' }}
                            />
                            <label>Trunk</label>
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
                                    {hosts
                                      .filter((host) => host.hostname !== link.selectedHost1)
                                      .map((host) => (
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
                                    {getInterfacesForHost(link.selectedHost2)
                                      .filter((intf) => !intf.interface.toLowerCase().includes('vlan'))
                                      .map((intf) => (
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
                        <div className="host-selection__switchport-configuration">
                          <div className="host-selection__vlan-multiple">
                            <h5 style={{ textAlign: 'center' }}>Add trunk allowed VLAN(s):</h5>
                            {link.vlans.length === 0 && (
                              <p style={{ color: 'grey', textAlign: 'center' }}>
                                No VLANs have been added yet.
                              </p>
                            )}
                            {link.vlans.map((selectedVlan, vlanIndex) => {
                              const filteredVlans = availableVlans.filter(v =>
                                !link.vlans.includes(v)
                              );
                              ;
                              return (
                                <div key={vlanIndex} className="vlan-selection-group">
                                  <select
                                    className="host-selection__dropdown"
                                    value={selectedVlan}
                                    onChange={(e) => handleVlanChange(index, vlanIndex, e.target.value)}
                                  >
                                    <option value="">-- Select VLAN --</option>
                                    {filteredVlans.map((vlanOption) => (
                                      <option key={vlanOption} value={vlanOption}>
                                        {vlanOption}
                                      </option>
                                    ))}
                                  </select>

                                  <CircleMinus
                                    style={{
                                      width: '25px',
                                      height: '25px',
                                      color: 'red',
                                      marginTop: '20px',
                                      marginLeft: '5px',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => handleRemoveVlan(index, vlanIndex)}
                                  />
                                </div>
                              );
                            })}


                            <button
                              className="button-add-vlan"
                              style={{ marginTop: '10px', width: '35%' }}
                              onClick={() => handleAddVlan(index)}
                            >
                              + Add VLAN
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Popup for Summary/Confirm */}
          {isShowPopup && (
            <div className="popup-overlay">
              <div className="popup-preview">
                {isResultLoading ? (
                  <div style={{ height: "100%" }}>
                    <h1 style={{ fontSize: '38px' }}>Result</h1>
                    <div className="loading-container">
                      <div className="spinner-lab" />
                      <p>Applying Configuration...</p>
                    </div>
                  </div>
                ) : backendResult ? (
                  <div style={{ height: "100%" }}>
                    <h1 style={{ fontSize: '38px' }}>Result</h1>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0px 10px" }}>
                      {/* CONFIGURATION SENT SECTION */}
                      <div
                        style={{
                          width: "48%",
                          backgroundColor: "#fff9e6", // Light yellowish background
                          padding: "10px",
                          border: "1px solid #ffe6b3",
                          borderRadius: "5px",
                        }}
                      >
                        <h4 style={{ marginTop: 0 }}>Configuration sent:</h4>
                        <div className="popup-table-section-result" style={{ maxHeight: "69vh" }}>
                          {links.map((link, index) => {
                            let rows: JSX.Element[] = [];
                            if (link.switchportMode === 'trunk') {
                              if (link.vlans.length > 0) {
                                rows = link.vlans.map((vlan, idx) => (
                                  <tr key={idx}>
                                    <td>{vlan || 'N/A'}</td>
                                    <td>{link.selectedInterface1 || 'N/A'}</td>
                                    <td>{link.selectedInterface2 || 'N/A'}</td>
                                  </tr>
                                ));
                              } else {
                                rows = [
                                  <tr key="no-vlan">
                                    <td>No VLAN selected</td>
                                    <td>{link.selectedInterface1 || 'N/A'}</td>
                                    <td>{link.selectedInterface2 || 'N/A'}</td>
                                  </tr>
                                ];
                              }
                            } else {
                              rows = [
                                <tr key="access">
                                  <td>Access</td>
                                  <td>{link.selectedInterface1 || 'N/A'}</td>
                                  <td>{link.selectedInterface2 || 'N/A'}</td>
                                </tr>
                              ];
                            }

                            const host1Name = link.selectedHost1;
                            const host2Name = link.selectedHost2;

                            return (
                              <div
                                key={index}
                                className="popup-table"
                                style={{
                                  marginBottom: "20px",
                                  backgroundColor: "#ffffff",
                                  borderRadius: "4px",
                                  padding: "10px",
                                }}
                              >
                                <h5>{`${host1Name}-${host2Name} Link ${index + 1}`}</h5>
                                <div className="popup-table-wrapper" style={{ overflowX: "auto" }}>
                                  <table
                                    border={1}
                                    style={{
                                      width: '100%',
                                      borderCollapse: 'collapse',
                                      backgroundColor: "#fff",
                                    }}
                                  >
                                    <thead>
                                      <tr style={{ backgroundColor: "#fff2e6" }}>
                                        <th>VLAN</th>
                                        <th>Outgoing Interface {host1Name}</th>
                                        <th>Outgoing Interface {host2Name}</th>
                                      </tr>
                                    </thead>
                                    <tbody>{rows}</tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* APPLIED ON DEVICE SECTION */}
                      {backendResult && backendResult.comparison && (
                        <div
                          style={{
                            width: "48%",
                            backgroundColor: "#e6f7ff",  // Light bluish background
                            padding: "10px",
                            border: "1px solid #b3daff",
                            borderRadius: "5px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <h4 style={{ marginTop: 0 }}>Applied on device:</h4>
                            <button
                              style={{
                                padding: "3px 10px",
                                cursor: "pointer",
                                borderRadius: "20px",
                                border: "none",
                                backgroundColor: "#3caee3",
                                color: "#fff",
                                fontSize: "14px",
                                height: "90%"
                              }}
                              onClick={() => setShowDetailsPopup(!showDetailsPopup)}
                            >
                              {showDetailsPopup ? "Hide Details" : "Show Details"}
                            </button>
                          </div>
                          <div className="popup-table-section-result" style={{ maxHeight: "69vh" }}>
                            {backendResult.comparison.map((comp: any, index: number) => {
                              const hostKeys = Object.keys(comp);
                              const sw1Data = comp[hostKeys[0]];
                              const sw2Data = comp[hostKeys[1]];
                              const host1Name = links[index]?.selectedHost1 || hostKeys[0];
                              const host2Name = links[index]?.selectedHost2 || hostKeys[1];
                              const allVlans = new Set([...sw1Data.parsed_vlans, ...sw2Data.parsed_vlans]);
                              // Compute match status: true if both devices are matched.
                              const isMatched = sw1Data.match === true && sw2Data.match === true;

                              return (
                                <div
                                  key={index}
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
                                      {`${host1Name}-${host2Name} Link ${index + 1}`}{" "}
                                    </h5>
                                    <span style={{ color: isMatched ? "green" : "red", marginLeft: "10px" }}>
                                      {isMatched ? "Matched" : "Unmatched"}
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
                                          <th>VLAN</th>
                                          <th>Outgoing Interface {host1Name}</th>
                                          <th>Outgoing Interface {host2Name}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {[...allVlans].map((vlan) => (
                                          <tr key={vlan}>
                                            <td>{vlan}</td>
                                            <td>{sw1Data.interface}</td>
                                            <td>{sw2Data.interface}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {/* Conditionally render the detail data */}
                                  {showDetailsPopup && (
                                    <div className="popup-overlay">
                                      <div className="popup-content-host" style={{ width: "65%", height: "95%" }}>
                                        <h4>Details Information</h4>
                                        <div className="popup-detail-section" style={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "4px", padding: "10px", height: "85%" }}>
                                          <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word", maxHeight: "100%" }}>
                                            {showDetails ? JSON.stringify(showDetails, null, 2) : "No detail data available"}
                                          </pre>

                                        </div>
                                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                          <button
                                          className="cancel-btn"
                                          onClick={() => setShowDetailsPopup(!showDetailsPopup)}
                                        >Close</button></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      )}
                    </div>

                    <div className="button-prev-section">
                      <button className="button-cancel-prev" style={{ fontSize: "15px" }} onClick={TogglePopup}>
                        Close
                      </button>
                    </div>
                  </div>

                ) : (
                  <div style={{ height: "100%" }}>
                    <h1 style={{ fontSize: '32px' }}>Summary</h1>
                    <div className="topology-prev">
                      <h5 style={{ margin: '10px 20px' }}>Network Topology</h5>
                      <SwitchNetworkTopology links={links} interfaceData={interfaceData} />
                    </div>
                    <div className="popup-table-section">
                      {links.map((link, index) => {
                        let rows: JSX.Element[] = [];
                        if (link.switchportMode === 'trunk') {
                          if (link.vlans.length > 0) {
                            rows = link.vlans.map((vlan, idx) => (
                              <tr key={idx}>
                                <td>{vlan || 'N/A'}</td>
                                <td>{link.selectedInterface1 || 'N/A'}</td>
                                <td>{link.selectedInterface2 || 'N/A'}</td>
                              </tr>
                            ));
                          } else {
                            rows = [
                              <tr key="no-vlan">
                                <td>No VLAN selected</td>
                                <td>{link.selectedInterface1 || 'N/A'}</td>
                                <td>{link.selectedInterface2 || 'N/A'}</td>
                              </tr>
                            ];
                          }
                        } else {
                          rows = [
                            <tr key="access">
                              <td>Access</td>
                              <td>{link.selectedInterface1 || 'N/A'}</td>
                              <td>{link.selectedInterface2 || 'N/A'}</td>
                            </tr>
                          ];
                        }

                        const host1Name = link.selectedHost1 || 'SW1';
                        const host2Name = link.selectedHost2 || 'SW2';

                        return (
                          <div key={index} className="popup-table">
                            <h5>{`${host1Name}-${host2Name} Link ${index + 1}`}</h5>
                            <div className="popup-table-wrapper">
                              <table border={1} style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th>VLAN</th>
                                    <th>Outgoing Interface {host1Name}</th>
                                    <th>Outgoing Interface {host2Name}</th>
                                  </tr>
                                </thead>
                                <tbody>{rows}</tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="button-prev-section">
                      <button className="button-cancel-prev" style={{ fontSize: "16px" }} onClick={TogglePopup}>
                        Back
                      </button>
                      <button className="button-confirm-prev" style={{ fontSize: "16px" }} onClick={handleConfirm}>
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          <div className="line-container">
            <div className="line"></div>
            <button onClick={handleAddLink} className={`button-sw-sw-add ${loading ? 'loading' : ''} `} disabled={loading}>
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
          <button
            className="button-sw-sw-submit"
            onClick={() => {
              handleSubmitAll();
            }}
            disabled={loading}
          >
            Verify
          </button>
        </div>

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

export default SwitchSwitch;
