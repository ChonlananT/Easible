import React, { useState, useEffect } from 'react';
import './RouterSwitch.css';
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
      // If the host selection changes, reset the related interface field
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

  // Submit all configuration data
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

    console.log('Sending data to backend:', requestData);

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
          // alert('Configuration submitted successfully!');
          console.log('Playbook created:', data.playbook);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error submitting configuration:', err);
      });
    setIsPopupOpen(true);
  };

  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () => {
    setIsNavDropdownOpen(!isNavDropdownOpen);
  };

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const togglePopup = () => {
    setIsPopupOpen(!isPopupOpen);
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
                                <option value="test">test</option>
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
                                {getInterfacesForHost(link.selectedSwitchHost).map((intf) => (
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
                          src="connect.png"  // Replace with your actual image path
                          alt="Remove link"
                          style={{ width: '150px', height: '100px' }}  // Adjust size as needed
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
                                <option value="test">test</option>
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
                                {getInterfacesForHost(link.selectedRouterHost).map((intf) => (
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
                                value={vlan.subnet || 24} // Default to 24 if vlan.subnet is empty
                                onChange={(e) => handleVlanChange(index, vlanIndex, 'subnet', e.target.value)}
                                placeholder="24"
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

        {!error && isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup-content-swh">
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
                                    ? `${vlanConfig.gateway} / ${vlanConfig.subnet}`
                                    : "Not Selected"}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4}>
                                No VLAN configuration provided.
                              </td>
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
                <button className="button-swh-close" onClick={togglePopup}>
                  Close
                </button>
                <button className="button-sw-sw-submit" onClick={togglePopup}>
                  Submit All
                </button>
              </div>
            </div>
          </div>
        )}




        <div className="submit-sw-sw-container">
          <button className="button-sw-sw-submit" onClick={handleSubmitAll}>
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

export default SwitchRouter;
