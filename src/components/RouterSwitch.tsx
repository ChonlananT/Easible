import React, { useState, useEffect } from 'react';
import './RouterSwitch.css';
import './Lab.css';
import './Bar.css';
import './SwitchSwitch.css';
import Spinner from './bootstrapSpinner.tsx';
import { ArrowLeftFromLine, ChevronDown, CircleMinus, Menu } from 'lucide-react';
import Navbar from "./Navbar.tsx";

type DropdownOption = {
  hostname: string;
  deviceType: string; // Added to identify the device type
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

type VlanConfig = {
  vlanId: string;
  gateway: string;
  subnet: string;
};

type LinkConfig = {
  selectedSwitchHost: string;
  selectedRouterHost: string;
  selectedSwitchInterface: string;
  selectedRouterInterface: string;
  vlanConfigs: VlanConfig[];
};

function SwitchRouter() {
  const [hosts, setHosts] = useState<DropdownOption[]>([]);
  const [interfaceData, setInterfaceData] = useState<InterfaceData[]>([]);
  const [links, setLinks] = useState<LinkConfig[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isResultPopupOpen, setIsResultPopupOpen] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [isResultLoading, setIsResultLoading] = useState(false);

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
    fetch('/api/show_detail_swtort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Assume API returns parsed_result as an array of host objects
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
        // Initialize with one empty link
        setLinks([
          {
            selectedSwitchHost: '',
            selectedRouterHost: '',
            selectedSwitchInterface: '',
            selectedRouterInterface: '',
            vlanConfigs: [],
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Retrieve interfaces for a given host by hostname
  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // Retrieve vlan_ids for a given host (used for switches)
  const getVlanIdsForHost = (hostname: string) => {
    const host = hosts.find((item) => item.hostname === hostname);
    return host && host.vlan_ids ? host.vlan_ids : [];
  };

  // Update link values
  const handleLinkChange = (
    linkIndex: number,
    field: keyof Omit<LinkConfig, 'vlanConfigs'>,
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      if (field === 'selectedSwitchHost') {
        newLinks[linkIndex] = {
          ...newLinks[linkIndex],
          [field]: value,
          selectedSwitchInterface: ''
        };
      } else if (field === 'selectedRouterHost') {
        newLinks[linkIndex] = {
          ...newLinks[linkIndex],
          [field]: value,
          selectedRouterInterface: ''
        };
      } else {
        newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
      }
      return newLinks;
    });
  };

  // Handle changes in VLAN config fields
  const handleVlanChange = (
    linkIndex: number,
    vlanIndex: number,
    field: keyof VlanConfig,
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const updatedVlanConfigs = newLinks[linkIndex].vlanConfigs.map((vlan, idx) =>
        idx === vlanIndex ? { ...vlan, [field]: value } : vlan
      );
      newLinks[linkIndex].vlanConfigs = updatedVlanConfigs;
      return newLinks;
    });
  };

  // Add a new VLAN configuration in the selected link
  const handleAddVlan = (linkIndex: number) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlanConfigs = [
        ...newLinks[linkIndex].vlanConfigs,
        { vlanId: '', gateway: '', subnet: '' },
      ];
      return newLinks;
    });
  };

  // Remove a VLAN configuration from the selected link
  const handleRemoveVlan = (linkIndex: number, vlanIndex: number) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      newLinks[linkIndex].vlanConfigs = newLinks[linkIndex].vlanConfigs.filter(
        (_, idx) => idx !== vlanIndex
      );
      return newLinks;
    });
  };

  // Add a new link
  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        selectedSwitchHost: '',
        selectedRouterHost: '',
        selectedSwitchInterface: '',
        selectedRouterInterface: '',
        vlanConfigs: [],
      },
    ]);
  };

  // Remove a link
  const handleRemoveLink = (linkIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== linkIndex));
  };

  // Submit configuration data for verification and show summary popup
  const handleSubmitAll = () => {
    setError('');

    // Validate that both hosts and interfaces are selected for every link
    for (let link of links) {
      if (
        !link.selectedSwitchHost ||
        !link.selectedRouterHost ||
        !link.selectedSwitchInterface ||
        !link.selectedRouterInterface
      ) {
        setError('Please select both hosts and interfaces for all links before submitting.');
        return;
      }
    }

    // Prepare the request data
    const requestData = links.map((link) => ({
      switchHost: link.selectedSwitchHost,
      routerHost: link.selectedRouterHost,
      switchInterface: link.selectedSwitchInterface,
      routerInterface: link.selectedRouterInterface,
      vlanConfigs: link.vlanConfigs,
    }));


    // ส่งข้อมูลไปยัง backend เพื่อตรวจสอบ (verify)
    fetch('/api/create_playbook_swtort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          // เปิด popup summary เพื่อให้ผู้ใช้ตรวจสอบข้อมูล
          setIsPopupOpen(true);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error submitting configuration:', err);
      });
  };

  // handleConfirm จะถูกเรียกเมื่อกด Confirm ใน Summary popup
  // handleConfirm function update
  const handleConfirm = () => {
    setError('');
    // Prepare the request data (or adjust as needed)
    const requestData = links.map((link) => ({
      switchHost: link.selectedSwitchHost,
      routerHost: link.selectedRouterHost,
      switchInterface: link.selectedSwitchInterface,
      routerInterface: link.selectedRouterInterface,
      vlanConfigs: link.vlanConfigs,
    }));

    

    // Open the result popup immediately and start the spinner
    setIsPopupOpen(false);
    setIsResultLoading(true);
    setIsResultPopupOpen(true);


    // Call the backend endpoint
    fetch('/api/run_playbook/swtort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          // Save the result data once it's available
          setResultData(data);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error executing playbook:', err);
      })
      .finally(() => {
        // Stop the spinner once the request is finished
        setIsResultLoading(false);
        // Optionally, if you want to auto-close the spinner even if result is empty,
        // you could do additional logic here.
      });
  };

  const isAllMatched = (comparison) => {
    // Check that every VLAN in router is matched.
    const routerMatches = Object.values(comparison.router).every(
      (vlanData: any) => vlanData.match === true
    );
    // Check that the switch configuration is matched.
    const switchMatches = comparison.switch.match === true;
    return routerMatches && switchMatches;
  };



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
          Configuration <span className="content-topic-small">(Router-Switch)</span>
        </div>
        <div className="content-board">
          <div className="all-links">
            {links.map((link, index) => (
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
                      {/* Switch Host Card */}
                      <div style={{ marginTop: '20px' }}>
                        <div className="host-card">
                          <div className="host-selection__dropdown-group">
                            <label>Switch:</label>
                            <div className="host-selection__dropdown-container">
                              <select
                                className="host-selection__dropdown"
                                onChange={(e) =>
                                  handleLinkChange(index, 'selectedSwitchHost', e.target.value)
                                }
                                value={link.selectedSwitchHost}
                              >
                                <option value="">-- Select a Switch Host --</option>
                                {!loading &&
                                  hosts
                                    .filter(
                                      (host: DropdownOption) =>
                                        host.deviceType.toLowerCase() === 'switch'
                                    )
                                    .map((host: DropdownOption) => (
                                      <option key={host.hostname} value={host.hostname}>
                                        {host.hostname}
                                      </option>
                                    ))}
                              </select>
                            </div>
                          </div>

                          <div className="host-selection__dropdown-group">
                            <label>Select Interface:</label>
                            <div className="host-selection__dropdown-container">
                              <select
                                className="host-selection__dropdown"
                                value={link.selectedSwitchInterface}
                                onChange={(e) =>
                                  handleLinkChange(index, 'selectedSwitchInterface', e.target.value)
                                }
                              >
                                <option value="">-- Select Interface --</option>
                                {getInterfacesForHost(link.selectedSwitchHost)
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

                      <div className="connect-pic-rt-rt">
                        <img
                          src="connect.png"
                          alt="Connect"
                          style={{ width: '150px', height: '100px' }}
                        />
                        <label>Inter-VLAN Routing</label>
                      </div>

                      {/* Router Host Card */}
                      <div style={{ marginTop: '20px' }}>
                        <div className="host-card">
                          <div className="host-selection__dropdown-group">
                            <label>Router:</label>
                            <div className="host-selection__dropdown-container">
                              <select
                                className="host-selection__dropdown"
                                onChange={(e) =>
                                  handleLinkChange(index, 'selectedRouterHost', e.target.value)
                                }
                                value={link.selectedRouterHost}
                              >
                                <option value="">-- Select a Router Host --</option>
                                {!loading &&
                                  hosts
                                    .filter(
                                      (host: DropdownOption) =>
                                        host.deviceType.toLowerCase() === 'router'
                                    )
                                    .map((host: DropdownOption) => (
                                      <option key={host.hostname} value={host.hostname}>
                                        {host.hostname}
                                      </option>
                                    ))}
                              </select>
                            </div>
                          </div>
                          <div className="host-selection__dropdown-group">
                            <label>Select Interface:</label>
                            <div className="host-selection__dropdown-container">
                              <select
                                className="host-selection__dropdown"
                                value={link.selectedRouterInterface}
                                onChange={(e) =>
                                  handleLinkChange(index, 'selectedRouterInterface', e.target.value)
                                }
                              >
                                <option value="">-- Select Interface --</option>
                                {getInterfacesForHost(link.selectedRouterHost)
                                  .filter((intf) => intf.interface.includes('Gigabit'))
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

                    {/* VLAN Configuration Section */}
                    <div className="vlan-rt-sw">
                      <h5 style={{ margin: '0px auto' }}>VLAN Configuration</h5>
                      <p />
                      {link.vlanConfigs.length === 0 ? (
                        <p style={{ color: 'grey', textAlign: 'center' }}>
                          No VLANs have been added yet.
                        </p>
                      ) : (
                        link.vlanConfigs.map((vlan, vlanIndex) => (
                          <div key={vlanIndex} className="vlan-rt-sw-input">
                            <div className="input-sw-sw-group">
                              <label>VLAN ID:</label>
                              <div className="host-selection__dropdown-container">
                                <select
                                  className="input-sw-sw"
                                  value={vlan.vlanId}
                                  onChange={(e) =>
                                    handleVlanChange(index, vlanIndex, 'vlanId', e.target.value)
                                  }
                                >
                                  <option value="">-- Select VLAN ID --</option>
                                  {getVlanIdsForHost(link.selectedSwitchHost).map((vlanOption) => (
                                    <option key={vlanOption} value={vlanOption}>
                                      {vlanOption}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="input-sw-sw-group">
                              <label>Gateway:</label>
                              <input
                                type="text"
                                value={vlan.gateway}
                                onChange={(e) =>
                                  handleVlanChange(index, vlanIndex, 'gateway', e.target.value)
                                }
                                placeholder="Enter Gateway"
                                className="input-sw-sw"
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ fontSize: '25px', marginTop: '10px' }}>/</span>
                            </div>
                            <div className="input-sw-sw-group" style={{ width: '35%' }}>
                              <label>Subnet:</label>
                              <input
                                type="number"
                                value={vlan.subnet}
                                onChange={(e) => handleVlanChange(index, vlanIndex, 'subnet', e.target.value)}
                                className="input-sw-sw"
                                min="1"
                                max="32"
                              />
                            </div>
                            <CircleMinus
                              style={{
                                width: '95px',
                                height: '95px',
                                color: 'red',
                                marginTop: '10px',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleRemoveVlan(index, vlanIndex)}
                            />
                          </div>
                        ))
                      )}
                      <button className="button-add-vlan" onClick={() => handleAddVlan(index)}>
                        + Add VLAN
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="line-container">
            <div className="line"></div>
            <button
              onClick={handleAddLink}
              className={`button-sw-sw-add ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner color="white" size="small" />
                  <span className="fetching-text">Fetching Data...</span>
                </>
              ) : (
                "+ Add Switch-Router Link"
              )}
            </button>
            <div className="line"></div>
          </div>
        </div>

        {/* Summary Popup after Verify */}
        {isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup-content-host" style={{ width: "60%" }}>
              <h2>Summary</h2>
              {links.length > 0 ? (
                links.map((link, index) => (
                  <div key={index} className="popup-table">
                    <h5>{`Link ${index + 1}`}</h5>
                    <div className="popup-table-wrapper">
                      <table className="summary-table">
                        <thead>
                          <tr>
                            <th>VLAN</th>
                            <th>Outgoing Interface Switch</th>
                            <th>Outgoing Interface Router</th>
                            <th>Gateway</th>
                          </tr>
                        </thead>
                        <tbody>
                          {link.vlanConfigs.length > 0 ? (
                            link.vlanConfigs.map((vlanConfig, idx) => (
                              <tr key={idx}>
                                <td>{vlanConfig.vlanId || "Not Selected"}</td>
                                <td>{link.selectedSwitchInterface || "Not Selected"}</td>
                                <td>{link.selectedRouterInterface || "Not Selected"}</td>
                                <td>
                                  {vlanConfig.gateway && vlanConfig.subnet
                                    ? `${vlanConfig.gateway}/${vlanConfig.subnet}`
                                    : "Not Selected"}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4}>No VLAN configuration provided.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <p>No links created.</p>
              )}
              <div className="submit-sw-sw-container" style={{ marginTop: '15px' }}>
                <button className="button-swh-close" onClick={() => setIsPopupOpen(false)}>
                  Close
                </button>
                <button className="button-sw-sw-submit" onClick={handleConfirm}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result Popup after Confirm with loading animation */}
        {isResultPopupOpen && (
          <div className="popup-overlay">
            <div className="popup-preview" style={{ width: "80%" }}>
              {isResultLoading ? (
                <div style={{ height: "100%" }}>
                  <h1 style={{ fontSize: "38px" }}>Result</h1>
                  <div className="loading-container">
                    <div className="spinner-lab" />
                    <p>Loading...</p>
                  </div>
                </div>
              ) : (
                <div style={{ height: "100%" }}>
                  <h1 style={{ fontSize: "38px" }}>Result</h1>
                  {/* Extract comparisons as an array */}
                  {(() => {
                    const comparisons = Array.isArray(resultData.comparison)
                      ? resultData.comparison
                      : [resultData.comparison];
                    return (

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "0px 10px",
                        }}
                      >
                        {/* Applied on device Section */}
                        {/* Applied on device Section */}
                        <div
                          style={{
                            width: "49%",
                            backgroundColor: "#e6f7ff",
                            padding: "10px",
                            border: "1px solid #b3daff",
                            borderRadius: "5px",
                          }}
                        >
                          <h4 style={{ marginTop: 0 }}>Applied on device:</h4>
                          <div
                            className="popup-table-section-result"
                            style={{ maxHeight: "69vh", overflowX: "auto" }}
                          >
                            {comparisons.map((comp: any, index: number) => {
                              const allMatched = isAllMatched(comp);
                              const hostName = `Switch-Router Link ${index + 1}`;
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
                                    <h5>{hostName}</h5>
                                    <p
                                      style={{
                                        color: allMatched ? "green" : "red",
                                        marginBottom: 0,
                                      }}
                                    >
                                      {allMatched ? "Matched" : "Unmatched"}
                                    </p>
                                  </div>
                                  <div className="popup-table-wrapper" style={{ overflowX: "auto" }}>
                                    <table
                                      style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        backgroundColor: "#fff",
                                      }}
                                      border={1}
                                    >
                                      <thead>
                                        <tr style={{ backgroundColor: "#f0f8ff" }}>
                                          <th>VLAN</th>
                                          <th>Outgoing Interface Switch</th>
                                          <th>Outgoing Interface Router</th>
                                          <th>Gateway</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(comp.router).map(
                                          ([vlan, details]: [string, any]) => (
                                            <tr key={vlan}>
                                              <td>{vlan}</td>
                                              <td>
                                                {comp.switch.backend &&
                                                  comp.switch.backend.interface
                                                  ? comp.switch.backend.interface
                                                  : "Not Selected"}
                                              </td>
                                              <td>
                                                {details.backend && details.backend.interface
                                                  ? details.backend.interface
                                                  : "Not Selected"}
                                              </td>
                                              <td>
                                                {details.backend &&
                                                  details.backend.gateway &&
                                                  details.backend.subnet
                                                  ? `${details.backend.gateway}/${details.backend.subnet}`
                                                  : "Not Selected"}
                                              </td>
                                            </tr>
                                          )
                                        )}
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
                            width: "49%",
                            backgroundColor: "#fff9e6",
                            padding: "10px",
                            border: "1px solid #ffe6b3",
                            borderRadius: "5px",
                          }}
                        >
                          <h4 style={{ marginTop: 0 }}>Configuration sent:</h4>
                          <div
                            className="popup-table-section-result"
                            style={{ maxHeight: "69vh", overflowX: "auto" }}
                          >
                            {comparisons.map((comp: any, index: number) => {
                              const host1Name = "Switch";
                              const host2Name = "Router";
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
                                      style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        backgroundColor: "#fff",
                                      }}
                                      border={1}
                                    >
                                      <thead>
                                        <tr style={{ backgroundColor: "#fff2e6" }}>
                                          <th>VLAN</th>
                                          <th>Outgoing Interface Switch</th>
                                          <th>Outgoing Interface Router</th>
                                          <th>Gateway</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(comp.router).map(
                                          ([vlan, details]: [string, any]) => (
                                            <tr key={vlan}>
                                              <td>{vlan}</td>
                                              <td>
                                                {comp.switch.frontend &&
                                                  comp.switch.frontend.interface
                                                  ? comp.switch.frontend.interface
                                                  : "Not Selected"}
                                              </td>
                                              <td>
                                                {details.frontend && details.frontend.interface
                                                  ? details.frontend.interface
                                                  : "Not Selected"}
                                              </td>
                                              <td>
                                                {details.frontend &&
                                                  details.frontend.gateway &&
                                                  details.frontend.subnet
                                                  ? `${details.frontend.gateway}/${details.frontend.subnet}`
                                                  : "Not Selected"}
                                              </td>
                                            </tr>
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="button-prev-section" style={{ marginTop: "10px" }}>
                    <button
                      className="button-cancel-prev"
                      style={{ fontSize: "15px" }}
                      onClick={() => setIsResultPopupOpen(false)}
                    >
                      Close
                    </button>
                  </div>
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
                }}
              >
                close
              </button>
            </div>
          </div>
        )}

        <div className="submit-sw-sw-container">
          <button className="button-sw-sw-submit" onClick={handleSubmitAll} disabled={loading}>
            Verify
          </button>
        </div>
      </div>
    </div>
  );
}

export default SwitchRouter;
