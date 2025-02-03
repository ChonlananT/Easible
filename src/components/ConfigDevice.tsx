import React, { useState, useEffect } from 'react';
import './Bar.css';
import './RouterRouter.css';
import './ConfigDevice.css';
import './SwitchSwitch.css'; // Assume reuse style or rename as needed
import Spinner from './bootstrapSpinner.tsx';

// Type Definitions
type GetHostsData = {
  deviceType: string;
  enablePassword: string;
  hostname: string;
  id: number;
  ipAddress: string;
  password: string;
  username: string;
};

type ShowDetailData = {
  hostname: string;
  interfaces: {
    interface: string;
    detail: {
      ip_address: string;
      status: string;
    };
  }[];
  vlan_ids?: number[];
};

type DropdownOption = {
  hostname: string;
  deviceType: string;
  interfaces: {
    interface: string;
    ip_address: string;
    status: string;
  }[];
  vlan_ids?: number[];
};

type VlanData = {
  vlanId: string;
  vlanName?: string;
  ipAddress?: string;
  cidr?: number;
  interface: string;
  mode: string;
};

type BridgePriorityData = {
  vlan: number;
  priority: number;
};

type ConfigIpData = {
  interface: string;
  ipAddress: string;
  cidr: number;
};

type LoopbackData = {
  loopbackNumber: number;
  ipAddress: string;
};

// HostConfig Type
type HostConfig = {
  deviceType: string;
  selectedHost: string;
  selectedCommand: string;
  vlanData?: VlanData;
  bridgePriority?: BridgePriorityData;
  configIp?: ConfigIpData;
  loopbackData?: LoopbackData;
};

function ConfigDevice() {
  const [hostsFromGetHosts, setHostsFromGetHosts] = useState<GetHostsData[]>([]);
  const [hostsFromShowDetail, setHostsFromShowDetail] = useState<ShowDetailData[]>([]);
  const [combinedHosts, setCombinedHosts] = useState<DropdownOption[]>([]);
  const [links, setLinks] = useState<HostConfig[]>([]);

  const [vlans, setVlans] = useState<{ [key: string]: number[] }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  // Commands available by device type
  const commandsByDeviceType: { [key: string]: { label: string; value: string }[] } = {
    switch: [
      { label: 'VLAN', value: 'vlan' },
      { label: 'Bridge Priority', value: 'bridge_priority' },
    ],
    router: [
      { label: 'Config IP Router', value: 'config_ip_router' },
      { label: 'Loopback', value: 'loopback' }, // Added Loopback
      // Add other router commands here
    ],
  };

  // DeviceTypes available
  const deviceTypes = [
    { label: '-- Select Device Type --', value: '' },
    { label: 'Switch', value: 'switch' },
    { label: 'Router', value: 'router' },
    // Add other DeviceTypes if any
  ];

  // Fetch hosts and show_detail data
  useEffect(() => {
    setLoading(true);
    // Fetch data from get_hosts and show_detail APIs concurrently
    Promise.all([
      fetch('http://localhost:5000/api/get_hosts', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }).then((res) => {
        if (!res.ok) throw new Error(`GET /api/get_hosts failed with status ${res.status}`);
        return res.json();
      }),
      fetch('http://localhost:5000/api/show_detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((res) => {
        if (!res.ok) throw new Error(`POST /api/show_detail failed with status ${res.status}`);
        return res.json();
      }),
    ])
      .then(([getHostsData, showDetailData]) => {
        setHostsFromGetHosts(getHostsData);
        setHostsFromShowDetail(showDetailData.parsed_result);

        // Select second half of parsed_result
        const halfLength = Math.floor(showDetailData.parsed_result.length / 2);
        const secondHalf = showDetailData.parsed_result.slice(halfLength);

        // Combine data from get_hosts and secondHalf using hostname as key
        const combined = getHostsData
          .map((host) => {
            const detail = secondHalf.find((d: ShowDetailData) => d.hostname === host.hostname);
            if (detail) {
              return {
                hostname: host.hostname,
                deviceType: host.deviceType,
                interfaces: detail.interfaces.map((intf) => ({
                  interface: intf.interface,
                  ip_address: intf.detail.ip_address,
                  status: intf.detail.status,
                })),
                vlan_ids: detail.vlan_ids || [],
              };
            }
            return null;
          })
          .filter((host) => host !== null) as DropdownOption[];

        setCombinedHosts(combined);

        // Create VLAN mapping
        const tempVlans: { [key: string]: number[] } = {};
        combined.forEach((host) => {
          tempVlans[host.hostname] = host.vlan_ids || [];
        });
        setVlans(tempVlans);

        // Initialize with one empty HostConfig
        setLinks([
          {
            deviceType: '',
            selectedHost: '',
            selectedCommand: '',
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Handle changes in HostConfig
  const handleHostChange = (
    hostIndex: number,
    field: keyof HostConfig | { group: 'vlanData' | 'bridgePriority' | 'configIp' | 'loopbackData'; key: string },
    value: string | number
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const hostConfig = { ...newLinks[hostIndex] };

      if (typeof field === 'string') {
        // Handle simple fields
        (hostConfig as any)[field] = value;

        // Initialize specific command data
        if (field === 'selectedCommand') {
          if (value === 'vlan') {
            hostConfig.vlanData = {
              vlanId: '',
              vlanName: '',
              ipAddress: '',
              cidr: 24,
              interface: '',
              mode: '',
            };
          } else if (value === 'bridge_priority') {
            hostConfig.bridgePriority = {
              vlan: 1, // Default VLAN ID
              priority: 4096, // Default priority
            };
          } else if (value === 'config_ip_router') {
            hostConfig.configIp = {
              interface: '',
              ipAddress: '',
              cidr: 24,
            };
          } else if (value === 'loopback') {
            hostConfig.loopbackData = {
              loopbackNumber: 0,
              ipAddress: '',
            };
          } else {
            // Remove all optional fields if command is not recognized
            delete hostConfig.vlanData;
            delete hostConfig.bridgePriority;
            delete hostConfig.configIp;
            delete hostConfig.loopbackData;
          }
        }

        // Reset selectedHost and command if deviceType changes
        if (field === 'deviceType') {
          hostConfig.selectedHost = '';
          hostConfig.selectedCommand = '';
          delete hostConfig.vlanData;
          delete hostConfig.bridgePriority;
          delete hostConfig.configIp;
          delete hostConfig.loopbackData;
        }
      } else {
        // Handle grouped fields
        if (field.group === 'vlanData') {
          hostConfig.vlanData = {
            ...hostConfig.vlanData!,
            [field.key]: value,
          };
        } else if (field.group === 'bridgePriority') {
          hostConfig.bridgePriority = {
            ...hostConfig.bridgePriority!,
            [field.key]: value,
          };
        } else if (field.group === 'configIp') {
          hostConfig.configIp = {
            ...hostConfig.configIp!,
            [field.key]: value,
          };
        } else if (field.group === 'loopbackData') {
          hostConfig.loopbackData = {
            ...hostConfig.loopbackData!,
            [field.key]: value,
          };
        }
      }

      newLinks[hostIndex] = hostConfig;
      return newLinks;
    });
  };

  // Get interfaces for a specific host
  const getInterfacesForHost = (hostname: string) => {
    const host = combinedHosts.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // Add a new HostConfig
  const handleAddHost = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        deviceType: '',
        selectedHost: '',
        selectedCommand: '',
      },
    ]);
  };

  // Remove a HostConfig
  const handleRemoveHost = (hostIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== hostIndex));
  };

  // Submit all configurations
  const handleSubmitAll = () => {
    setError('');

    // Validate all HostConfigs
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link.deviceType || !link.selectedHost || !link.selectedCommand) {
        setError(`Please select device type, host, and command for all entries.`);
        return;
      }

      // Validate based on command type
      if (link.selectedCommand === 'vlan') {
        const vlan = link.vlanData;
        if (!vlan || !vlan.vlanId || !vlan.interface || !vlan.mode) {
          setError(`Please fill all required VLAN fields for entry ${i + 1}.`);
          return;
        }
      }

      if (link.selectedCommand === 'bridge_priority') {
        const bridge = link.bridgePriority;
        if (!bridge || !bridge.vlan || bridge.priority === undefined) {
          setError(`Please fill all required Bridge Priority fields for entry ${i + 1}.`);
          return;
        }
      }

      if (link.selectedCommand === 'config_ip_router') {
        const configIp = link.configIp;
        if (!configIp || !configIp.interface || !configIp.ipAddress || !configIp.cidr) {
          setError(`Please fill all required Config IP fields for entry ${i + 1}.`);
          return;
        }
      }

      if (link.selectedCommand === 'loopback') {
        const loopback = link.loopbackData;
        if (!loopback || !loopback.loopbackNumber || !loopback.ipAddress) {
          setError(`Please fill all required Loopback fields for entry ${i + 1}.`);
          return;
        }
      }
    }

    // Create request data
    const requestData = links.map((link) => ({
      deviceType: link.deviceType,
      hostname: link.selectedHost,
      command: link.selectedCommand,
      ...(link.selectedCommand === 'vlan' && link.vlanData
        ? {
            vlanData: {
              vlanId: link.vlanData.vlanId,
              vlanName: link.vlanData.vlanName,
              ipAddress: link.vlanData.ipAddress,
              cidr: link.vlanData.cidr,
              interface: link.vlanData.interface,
              mode: link.vlanData.mode,
            },
          }
        : {}),
      ...(link.selectedCommand === 'bridge_priority' && link.bridgePriority
        ? {
            bridgePriority: {
              vlan: link.bridgePriority.vlan,
              priority: link.bridgePriority.priority,
            },
          }
        : {}),
      ...(link.selectedCommand === 'config_ip_router' && link.configIp
        ? {
            configIp: {
              interface: link.configIp.interface,
              ipAddress: link.configIp.ipAddress,
              cidr: link.configIp.cidr,
            },
          }
        : {}),
      ...(link.selectedCommand === 'loopback' && link.loopbackData
        ? {
            loopbackData: {
              loopbackNumber: link.loopbackData.loopbackNumber,
              ipAddress: link.loopbackData.ipAddress,
            },
          }
        : {}),
    }));

    console.log('Sending data to backend:', requestData);

    fetch('http://localhost:5000/api/create_playbook_configdevice', {
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

  return (
    <div className="App">
      <ul className="nav-links">
        <img src="/easible-name.png" alt="" className="dashboard-icon" />
        <li className="center"><a href="/dashboard">Dashboard</a></li>
        <li className="center"><a href="/hosts">Hosts</a></li>
        <li className="center"><a href="/jobs">Configuration</a></li>
        <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
        <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
        <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
        <li className="center sub-topic"><a href="/configdevice" style={{ color: '#8c94dc' }}>config device</a></li>
        <li className="center"><a href="/topology">Lab Check</a></li>
      </ul>

      <div className="content">
        <div className='content-topic'>
          Configuration 
          <span className='content-topic-small'> (Config Device)</span>
        </div>
        <div className="content-board">
          <div className="all-links">
            {links.map((link, index) => (
              <div
                key={index}
                className="switch-switch"
              >
                <div className='top-link'>
                  <div className='link-index'>Host Config {index + 1}</div>
                  <div className="remove-link-container">
                    {links.length > 1 && (
                      <button
                        onClick={() => handleRemoveHost(index)}
                        className='button-sw-sw-remove'
                      >
                        <img
                          src="bin.png"  // Replace with your actual image path
                          alt="Remove link"
                          style={{ width: '45px', height: '27px' }}  // Adjust size as needed
                        />
                      </button>
                    )}
                  </div>
                </div>
                <div className="content-section">
                  <div className="host-selection-container">
                    <div className="host-selection__hosts">
                      {/* Select Device Type */}
                      <div className="host-selection__dropdown-group">
                        <label>Select Device Type:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.deviceType}
                          onChange={(e) => handleHostChange(index, 'deviceType', e.target.value)}
                        >
                          {deviceTypes.map((dt) => (
                            <option key={dt.value} value={dt.value}>
                              {dt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Select Host */}
                      <div className="host-selection__dropdown-group">
                        <label>Select Host:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.selectedHost}
                          onChange={(e) => handleHostChange(index, 'selectedHost', e.target.value)}
                          disabled={!link.deviceType} // Disable if DeviceType not selected
                        >
                          <option value="">-- Select a Host --</option>
                          <option value="router">test</option>
                          {combinedHosts
                            .filter((host) => host.deviceType === link.deviceType)
                            .map((host: DropdownOption) => (
                              <option key={host.hostname} value={host.hostname}>
                                {host.hostname}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Select Command */}
                      <div className="host-selection__dropdown-group">
                        <label>Select Command:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.selectedCommand}
                          onChange={(e) => handleHostChange(index, 'selectedCommand', e.target.value)}
                          disabled={!link.selectedHost} // Disable if Host not selected
                        >
                          <option value="">-- Select a Command --</option>
                          {link.deviceType && commandsByDeviceType[link.deviceType].map((command) => (
                            <option key={command.value} value={command.value}>
                              {command.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="config-command-section">
                    {/* VLAN Configuration */}
                    {link.selectedCommand === 'vlan' && link.vlanData && (
                      <div className="config-command-board">
                        <div className="vlan-config-topic">
                          <h5>VLAN Configuration</h5>
                        </div>
                        
                        <div className='vlan-config-content'>
                          <div className="vlan-config-device">
                            <div className="vlan-name-id">
                              <div className="config-device-input-text">
                                <label>VLAN ID:</label>
                                <input
                                  type="text"
                                  value={link.vlanData.vlanId}
                                  onChange={(e) =>
                                    handleHostChange(index, { group: 'vlanData', key: 'vlanId' }, e.target.value)
                                  }
                                  placeholder="Enter VLAN ID"
                                />
                              </div>

                              <div className="config-device-input-text">
                                <label>VLAN Name (optional):</label>
                                <input
                                  type="text"
                                  value={link.vlanData.vlanName}
                                  onChange={(e) =>
                                    handleHostChange(index, { group: 'vlanData', key: 'vlanName' }, e.target.value)
                                  }
                                  placeholder="Enter VLAN Name"
                                />
                              </div>
                            </div>
                            <div className='ip-subnet-group-confdev'>
                              <div className="ip-text">
                                <label>IP Address (optional):</label>
                                <input
                                  type="text"
                                  value={link.vlanData.ipAddress}
                                  onChange={(e) =>
                                    handleHostChange(index, { group: 'vlanData', key: 'ipAddress' }, e.target.value)
                                  }
                                  placeholder="Enter IP Address"
                                />
                              </div>

                              <div className="config-device-input-text">
                                <label>Subnet:</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={32}
                                  value={link.vlanData.cidr}
                                  onChange={(e) =>
                                    handleHostChange(index, { group: 'vlanData', key: 'cidr' }, parseInt(e.target.value, 10))
                                  }
                                  placeholder="Enter CIDR (e.g., 24)"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="line-vertical-confdev"></div>

                          <div className="vlan-config-device">
                            <div className="host-selection__dropdown-group">
                              <label>Select Interface:</label>
                              <select
                                className="host-selection__dropdown"
                                value={link.vlanData.interface}
                                onChange={(e) => handleHostChange(index, { group: 'vlanData', key: 'interface' }, e.target.value)}
                              >
                                <option value="">-- Select Interface --</option>
                                {link.selectedHost &&
                                  getInterfacesForHost(link.selectedHost).map((intf) => (
                                    <option key={intf.interface} value={intf.interface}>
                                      {intf.interface} ({intf.status})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="host-selection__dropdown-group">
                              <label>Mode:</label>
                              <select
                                className="host-selection__dropdown"
                                value={link.vlanData.mode}
                                onChange={(e) => handleHostChange(index, { group: 'vlanData', key: 'mode' }, e.target.value)}
                              >
                                <option value="">-- Select Mode --</option>
                                <option value="trunk">Trunk</option>
                                <option value="access">Access</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bridge Priority Configuration */}
                    {link.selectedCommand === 'bridge_priority' && link.bridgePriority && (
                      <div className="config-command-board">
                        <h5>Bridge Priority Configuration</h5>
                        <div className="host-selection__dropdown-group">
                          <label>Select VLAN:</label>
                          <select
                            className="host-selection__dropdown"
                            value={link.bridgePriority.vlan}
                            onChange={(e) =>
                              handleHostChange(index, { group: 'bridgePriority', key: 'vlan' }, parseInt(e.target.value, 10))
                            }
                          >
                            <option value="">-- Select VLAN --</option>
                            {link.selectedHost &&
                              vlans[link.selectedHost].map((vlan) => (
                                <option key={vlan} value={vlan}>
                                  {vlan}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="host-selection__dropdown-group">
                          <label>Bridge Priority:</label>
                          <select
                            className="host-selection__dropdown"
                            value={link.bridgePriority.priority}
                            onChange={(e) =>
                              handleHostChange(index, { group: 'bridgePriority', key: 'priority' }, parseInt(e.target.value, 10))
                            }
                          >
                            <option value="">-- Select Priority --</option>
                            {/* Create options from 0 to 4096 in steps of 256 */}
                            {Array.from({ length: 17 }, (_, i) => i * 256).map((priority) => (
                              <option key={priority} value={priority}>
                                {priority}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Config IP Router */}
                    {link.selectedCommand === 'config_ip_router' && link.configIp && (
                      <div className="config-command-board">
                        <h4>Config IP Router</h4>
                        <div className="host-selection__dropdown-group">
                          <label>Select Interface:</label>
                          <select
                            className="host-selection__dropdown"
                            value={link.configIp.interface}
                            onChange={(e) =>
                              handleHostChange(index, { group: 'configIp', key: 'interface' }, e.target.value)
                            }
                          >
                            <option value="">-- Select Interface --</option>
                            {link.selectedHost &&
                              getInterfacesForHost(link.selectedHost).map((intf) => (
                                <option key={intf.interface} value={intf.interface}>
                                  {intf.interface} ({intf.status})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="config-device-input-text">
                          <label>IP Address:</label>
                          <input
                            type="text"
                            value={link.configIp.ipAddress}
                            onChange={(e) =>
                              handleHostChange(index, { group: 'configIp', key: 'ipAddress' }, e.target.value)
                            }
                            placeholder="Enter IP Address"
                          />
                        </div>

                        <div className="config-device-input-text">
                          <label>Subnet:</label>
                          <input
                            type="number"
                            min={1}
                            max={32}
                            value={link.configIp.cidr}
                            onChange={(e) =>
                              handleHostChange(index, { group: 'configIp', key: 'cidr' }, parseInt(e.target.value, 10))
                            }
                            placeholder="Enter CIDR (e.g., 24)"
                          />
                        </div>
                      </div>
                    )}

                    {/* Loopback Configuration */}
                    {link.selectedCommand === 'loopback' && link.loopbackData && (
                      <div className="config-command-board">
                        <h5>Loopback Configuration</h5>
                        <div className="loopback-config-content">
                          <div className="host-selection__dropdown-group">
                            <label>Loopback Number:</label>
                            <input
                              type="text"
                              value={link.loopbackData.loopbackNumber}
                              onChange={(e) =>
                                handleHostChange(index, { group: 'loopbackData', key: 'loopbackNumber' }, e.target.value)
                              }
                              placeholder="Enter Loopback Number"
                            />
                          </div>

                          <div className="config-device-input-text">
                            <label>IP Address:</label>
                            <input
                              type="text"
                              value={link.loopbackData.ipAddress}
                              onChange={(e) =>
                                handleHostChange(index, { group: 'loopbackData', key: 'ipAddress' }, e.target.value)
                              }
                              placeholder="Enter IP Address"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="line-container">
            <div className="line"></div>
            <button 
              onClick={handleAddHost} 
              className={`button-sw-sw-add ${loading ? 'loading' : ''}`} 
              // disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner color="white" size="small" /> {/* Spinner in front of the text */}
                  <span className="fetching-text">Fetching Data...</span>
                </>
              ) : (
                "+ Add Host Config"
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

export default ConfigDevice;
