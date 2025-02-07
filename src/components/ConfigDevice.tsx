import React, { useState, useEffect } from 'react';
import './Bar.css';
import './RouterRouter.css';
import './ConfigDevice.css';
import './SwitchSwitch.css';
import Spinner from './bootstrapSpinner.tsx';
import { ArrowLeftFromLine, ChevronDown, Menu } from 'lucide-react';

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
  vlans?: VlanInfo[];
};

export type VlanInfo = {
  vlan_id: number;
  stp_detail?: {
    root_mac: string;
    bridge_priority_in_brackets: string;
    bridge_mac: string;
    isRoot: boolean;
  };
};

type DropdownOption = {
  hostname: string;
  deviceType: string;
  interfaces: {
    interface: string;
    ip_address: string;
    status: string;
  }[];
  vlans?: VlanInfo[];
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
  vlan: number; // เลือก vlan_id จาก dropdown
  priority: number; // ผู้ใช้สามารถเลือก override ค่า priority ได้
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

type StaticRouteData = {
  prefix: string;
  cidr: number;
  nextHop: string
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
  staticRouteData?: StaticRouteData;
};

function ConfigDevice() {
  const [hostsFromGetHosts, setHostsFromGetHosts] = useState<GetHostsData[]>([]);
  // state สำหรับเก็บรายละเอียดของ device type (key: 'switch' หรือ 'router')
  const [detailsByType, setDetailsByType] = useState<{ [deviceType: string]: ShowDetailData[] }>({});
  const [combinedHosts, setCombinedHosts] = useState<DropdownOption[]>([]);
  const [links, setLinks] = useState<HostConfig[]>([]);
  // state สำหรับ mapping vlans โดยใช้ hostname เป็น key
  const [vlans, setVlans] = useState<{ [key: string]: VlanInfo[] }>({});
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
      { label: 'Loopback', value: 'loopback' },
      { label: 'Static Route', value: 'static_route' },
    ],
  };

  // DeviceTypes available
  const deviceTypes = [
    { label: '-- Select Device Type --', value: '' },
    { label: 'Switch', value: 'switch' },
    { label: 'Router', value: 'router' },
  ];

  // เริ่มต้น fetch get_hosts
  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:5000/api/get_hosts', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok)
          throw new Error(`GET /api/get_hosts failed with status ${res.status}`);
        return res.json();
      })
      .then((getHostsData) => {
        setHostsFromGetHosts(getHostsData);
        // สร้าง initial HostConfig
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

  // ฟังก์ชันรวมข้อมูลจาก get_hosts และ details จาก API (จับคู่โดย hostname)
  const combineHostsData = () => {
    const combined = hostsFromGetHosts
      .map((host) => {
        const details = detailsByType[host.deviceType];
        if (details) {
          const detail = details.find((d) => d.hostname === host.hostname);
          if (detail) {
            return {
              hostname: host.hostname,
              deviceType: host.deviceType,
              interfaces: detail.interfaces.map((intf) => ({
                interface: intf.interface,
                ip_address: intf.detail.ip_address,
                status: intf.detail.status,
              })),
              vlans: detail.vlans || [],
            };
          }
        }
        return null;
      })
      .filter((host) => host !== null) as DropdownOption[];

    setCombinedHosts(combined);

    // สร้าง mapping สำหรับ vlans โดยใช้ hostname เป็น key
    const tempVlans: { [key: string]: VlanInfo[] } = {};
    combined.forEach((host) => {
      tempVlans[host.hostname] = host.vlans || [];
    });
    setVlans(tempVlans);
  };

  useEffect(() => {
    combineHostsData();
  }, [hostsFromGetHosts, detailsByType]);

  // ฟังก์ชันค้นหา root info สำหรับ VLAN ที่เลือกจาก combinedHosts (ค้นหาจากทุก host)
  const getRootInfo = (vlanId: number): { hostname: string; priority: string } | null => {
    for (let host of combinedHosts) {
      if (host.vlans) {
        const found = host.vlans.find(
          (v) =>
            v.vlan_id === vlanId &&
            v.stp_detail &&
            v.stp_detail.isRoot === true
        );
        if (found && found.stp_detail) {
          return {
            hostname: host.hostname,
            priority: found.stp_detail.bridge_priority_in_brackets,
          };
        }
      }
    }
    return null;
  };

  // ฟังก์ชันสำหรับดึง "Your host priority" จาก host ที่เลือก (จาก API)
  const getCurrentHostPriority = (selectedHost: string, vlanId: number): string | null => {
    const hostData = combinedHosts.find((host) => host.hostname === selectedHost);
    if (hostData && hostData.vlans) {
      const vlanObj = hostData.vlans.find((v) => v.vlan_id === vlanId);
      if (vlanObj && vlanObj.stp_detail) {
        return vlanObj.stp_detail.bridge_priority_in_brackets;
      }
    }
    return null;
  };

  // Handle changes in HostConfig
  const handleHostChange = (
    hostIndex: number,
    field:
      | keyof HostConfig
      | { group: 'vlanData' | 'bridgePriority' | 'configIp' | 'loopbackData' | 'staticRouteData'; key: string },
    value: string | number
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const hostConfig = { ...newLinks[hostIndex] };

      if (typeof field === 'string') {
        (hostConfig as any)[field] = value;

        // เมื่อเปลี่ยน deviceType ให้รีเซ็ต selectedHost, selectedCommand และข้อมูลที่เกี่ยวข้อง
        if (field === 'deviceType') {
          hostConfig.selectedHost = '';
          hostConfig.selectedCommand = '';
          delete hostConfig.vlanData;
          delete hostConfig.bridgePriority;
          delete hostConfig.configIp;
          delete hostConfig.loopbackData;
          delete hostConfig.staticRouteData;

          // ถ้า deviceType เป็น "switch" หรือ "router" ให้เรียก API show_detail_configdevice
          if (value === 'switch' || value === 'router') {
            if (!detailsByType[value]) {
              fetch('http://localhost:5000/api/show_detail_configdevice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceType: value }),
              })
                .then((res) => {
                  if (!res.ok)
                    throw new Error(`POST /api/show_detail_configdevice failed with status ${res.status}`);
                  return res.json();
                })
                .then((data) => {
                  // API คาดว่าจะส่งกลับ { parsed_result: [...] }
                  setDetailsByType((prev) => ({
                    ...prev,
                    [value]: data.parsed_result,
                  }));
                })
                .catch((err) => setError(err.message));
            }
          }
        }

        // เมื่อเปลี่ยน selectedCommand ให้ initialize ค่าเฉพาะ command นั้นๆ
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
              vlan: 0, // ต้องเลือก vlan_id จาก dropdown
              priority: 0, // ให้ค่าเริ่มต้นเป็น 0 (หรือจะปรับเป็นค่า default จาก API ก็ได้)
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
          } else if (value === 'static_route') {
            hostConfig.staticRouteData = {
              prefix: '',
              cidr: 24,
              nextHop: '',
            };
          } else {
            delete hostConfig.vlanData;
            delete hostConfig.bridgePriority;
            delete hostConfig.configIp;
            delete hostConfig.loopbackData;
          }
        }
      } else {
        // จัดการกับ group fields
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
        } else if (field.group === 'staticRouteData') {
          hostConfig.staticRouteData = {
            ...hostConfig.staticRouteData!,
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

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link.deviceType || !link.selectedHost || !link.selectedCommand) {
        setError(`Please select device type, host, and command for all entries.`);
        return;
      }

      if (link.selectedCommand === 'vlan') {
        const vlan = link.vlanData;
        if (!vlan || !vlan.vlanId || !vlan.interface || !vlan.mode) {
          setError(`Please fill all required VLAN fields for entry ${i + 1}.`);
          return;
        }
      }

      if (link.selectedCommand === 'bridge_priority') {
        const bridge = link.bridgePriority;
        if (!bridge || bridge.vlan === 0) {
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

      if (link.selectedCommand === 'static_route') {
        const static_route = link.staticRouteData;
        if (!static_route || !static_route.prefix || !static_route.cidr || !static_route.nextHop) {
          setError(`Please fill all required Static route fields for entry ${i + 1}.`);
          return;
        }
      }
    }

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
              // ใช้ค่าที่ผู้ใช้เลือกใน dropdown
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
      ...(link.selectedCommand === 'static_route' && link.staticRouteData
        ? {
            staticRouteData: {
              prefix: link.staticRouteData.prefix,
              cidr: link.staticRouteData.cidr,
              nextHop: link.staticRouteData.nextHop
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

  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem('isNavOpen');
    return savedNavState === 'true';
  });

  useEffect(() => {
    localStorage.setItem('isNavOpen', isNavOpen.toString());
  }, [isNavOpen]);


  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () =>{
    setIsNavDropdownOpen(!isNavDropdownOpen);
  }

  return (
    <div className="App">
      <div className={`nav-links-container ${isNavOpen ? "" : "closed"}`}>
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
          <li className="center"><a href="/dashboard">Dashboard</a></li>
          <li className="center"><a href="/hosts">Devices</a></li>
          <li 
            className="center" 
            onClick={toggleNavDropdown} 
            style={{ cursor: 'pointer', color: 'black' }} 
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = '#8c94dc'} 
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'black'}
          >
            <a>Configuration  </a>
            <ChevronDown className={isNavDropdownOpen ? "chevron-nav rotated" : "chevron-nav"}/>
          </li>

          <ul className={`nav-dropdown ${isNavDropdownOpen ? "open" : ""}`}>
            <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
            <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
            <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
            <li className="center sub-topic"><a href="/switchhost">switch-host</a></li>
            <li className="center sub-topic"><a href="/configdevice" style={{ color: '#8c94dc' }}>config device</a></li>
          </ul>
          <li className="center"><a href="/lab">Lab Check</a></li>
        </ul>
      </div>

      <div className={`content ${isNavOpen ? "expanded" : "full-width"}`}>
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
          Configuration
          <span className="content-topic-small"> (Config Device)</span>
        </div>
        <div className="content-board">
          <div className="all-links">
            {links.map((link, index) => (
              <div key={index} className="switch-switch">
                <div className="top-link">
                  <div className="link-index">Device Config {index + 1}</div>
                  <div className="remove-link-container">
                    {links.length > 1 && (
                      <button onClick={() => handleRemoveHost(index)} className="button-sw-sw-remove">
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
                        <label>Select Device:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.selectedHost}
                          onChange={(e) => handleHostChange(index, 'selectedHost', e.target.value)}
                          disabled={!link.deviceType || loading}
                        >
                          {loading ? (
                            <option value="">Loading devices...</option>
                          ) : combinedHosts.filter((host) => host.deviceType === link.deviceType).length === 0 ? (
                            <option value="">No devices available</option>
                          ) : (
                            <>
                              <option value="">-- Select a Device --</option>
                              {combinedHosts
                                .filter((host) => host.deviceType === link.deviceType)
                                .map((host: DropdownOption) => (
                                  <option key={host.hostname} value={host.hostname}>
                                    {host.hostname}
                                  </option>
                                ))}
                            </>
                          )}
                        </select>
                      </div>


                      {/* Select Command */}
                      <div className="host-selection__dropdown-group">
                        <label>Select Command:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.selectedCommand}
                          onChange={(e) => handleHostChange(index, 'selectedCommand', e.target.value)}
                          disabled={!link.selectedHost}
                        >
                          <option value="">-- Select a Command --</option>
                          {link.deviceType &&
                            commandsByDeviceType[link.deviceType].map((command) => (
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
                        <div className="vlan-config-content">
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
                            <div className="ip-subnet-group-confdev">
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
                                onChange={(e) =>
                                  handleHostChange(index, { group: 'vlanData', key: 'interface' }, e.target.value)
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
                            <div className="host-selection__dropdown-group">
                              <label>Mode:</label>
                              <select
                                className="host-selection__dropdown"
                                value={link.vlanData.mode}
                                onChange={(e) =>
                                  handleHostChange(index, { group: 'vlanData', key: 'mode' }, e.target.value)
                                }
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
                              handleHostChange(
                                index,
                                { group: 'bridgePriority', key: 'vlan' },
                                parseInt(e.target.value, 10)
                              )
                            }
                          >
                            <option value="">-- Select VLAN --</option>
                            {link.selectedHost &&
                              vlans[link.selectedHost] &&
                              vlans[link.selectedHost].map((vlanObj) => (
                                <option key={vlanObj.vlan_id} value={vlanObj.vlan_id}>
                                  {`VLAN ${vlanObj.vlan_id}`}
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
                              handleHostChange(
                                index,
                                { group: 'bridgePriority', key: 'priority' },
                                parseInt(e.target.value, 10)
                              )
                            }
                          >
                            <option value="">-- Select Priority --</option>
                            {Array.from({ length: 16 }, (_, i) => i * 4096).map((priority) => (
                              <option key={priority} value={priority}>
                                {priority}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* แสดงข้อมูล Current root และ Your host priority เมื่อมีการเลือก VLAN */}
                        {link.bridgePriority.vlan ? (
                          (() => {
                            const rootInfo = getRootInfo(link.bridgePriority.vlan);
                            const hostPriority = getCurrentHostPriority(link.selectedHost, link.bridgePriority.vlan);
                            return (
                              <>
                                {rootInfo && (
                                  <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                                    Current root: {rootInfo.hostname} | Root Priority: {rootInfo.priority}
                                  </div>
                                )}
                                {hostPriority && (
                                  <div style={{ marginTop: '8px' }}>
                                    Your host priority: {hostPriority}
                                  </div>
                                )}
                              </>
                            );
                          })()
                        ) : null}
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
                          <div className="config-device-input-text">
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

                    {/* Static Route Configuration */}
                    {link.selectedCommand === 'static_route' && link.staticRouteData && (
                      <div className="config-command-board">
                        <h5>Static Route Configuration</h5>
                        <div className="loopback-config-content">
                          <div className="config-device-input-text">
                            <label>Prefix:</label>
                            <input
                              type="text"
                              value={link.staticRouteData.prefix}
                              onChange={(e) =>
                                handleHostChange(index, { group: 'staticRouteData', key: 'prefix' }, e.target.value)
                              }
                              placeholder="Enter Prefix"
                            />
                          </div>
                          <div className="config-device-input-text">
                            <label>Subnet mask(CIDR):</label>
                            <input
                              type="text"
                              value={link.staticRouteData.cidr}
                              onChange={(e) =>
                                handleHostChange(index, { group: 'staticRouteData', key: 'cidr' }, e.target.value)
                              }
                              placeholder="Enter Subnet mask"
                            />
                          </div>
                          <div className="config-device-input-text">
                            <label>Next Hop:</label>
                            <input
                              type="text"
                              value={link.staticRouteData.nextHop}
                              onChange={(e) =>
                                handleHostChange(index, { group: 'staticRouteData', key: 'nextHop' }, e.target.value)
                              }
                              placeholder="Enter Next Hop"
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
            <button onClick={handleAddHost} className={`button-sw-sw-add ${loading ? 'loading' : ''}`}>
              {loading ? (
                <>
                  <Spinner color="white" size="small" />
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
