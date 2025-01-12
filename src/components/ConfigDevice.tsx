import React, { useState, useEffect } from 'react';
import './Bar.css';
import './RouterRouter.css';
import './ConfigDevice.css';
import './SwitchSwitch.css'; // สมมติ reuse style เดิม หรือเปลี่ยนชื่อไฟล์ใหม่
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

// HostConfig Type
type HostConfig = {
  deviceType: string;
  selectedHost: string;
  selectedCommand: string;
  vlanData?: VlanData;
  bridgePriority?: BridgePriorityData;
  configIp?: ConfigIpData;
};

function ConfigDevice() {
  const [hostsFromGetHosts, setHostsFromGetHosts] = useState<GetHostsData[]>([]);
  const [hostsFromShowDetail, setHostsFromShowDetail] = useState<ShowDetailData[]>([]);
  const [combinedHosts, setCombinedHosts] = useState<DropdownOption[]>([]);
  const [links, setLinks] = useState<HostConfig[]>([]);

  const [vlans, setVlans] = useState<{ [key: string]: number[] }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  // คำสั่งที่มีให้เลือก โดยจะแตกต่างกันตาม DeviceType
  const commandsByDeviceType: { [key: string]: { label: string; value: string }[] } = {
    switch: [
      { label: 'VLAN', value: 'vlan' },
      { label: 'Bridge Priority', value: 'bridge_priority' },
    ],
    router: [
      { label: 'Config IP Router', value: 'config_ip_router' },
      // เพิ่มคำสั่งอื่นๆ สำหรับ Router ได้ที่นี่
    ],
  };

  // DeviceTypes ที่มีให้เลือก
  const deviceTypes = [
    { label: '-- Select Device Type --', value: '' },
    { label: 'Switch', value: 'switch' },
    { label: 'Router', value: 'router' },
    // เพิ่ม DeviceType อื่นๆ ถ้ามี
  ];

  // useEffect: ดึงข้อมูลจาก backend ทั้งสอง API และใช้ secondHalf ของ show_detail
  useEffect(() => {
    setLoading(true);
    // ดึงข้อมูลจาก get_hosts และ show_detail พร้อมกัน
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

        // เลือก secondHalf ของ parsed_result
        const halfLength = Math.floor(showDetailData.parsed_result.length / 2);
        const secondHalf = showDetailData.parsed_result.slice(halfLength);

        // รวมข้อมูลจาก get_hosts และ secondHalf โดยใช้ hostname เป็นตัวเชื่อม
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

        // สร้าง mapping สำหรับ VLAN
        const tempVlans: { [key: string]: number[] } = {};
        combined.forEach((host) => {
          tempVlans[host.hostname] = host.vlan_ids || [];
        });
        setVlans(tempVlans);

        // เริ่มด้วย HostConfig เปล่า 1 HostConfig
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

  // ----------------------------------------------------------------
  // ฟังก์ชันเปลี่ยนค่าทั่วไปใน HostConfig
  // ----------------------------------------------------------------
  const handleHostChange = (
    hostIndex: number,
    field: keyof HostConfig | { group: 'vlanData' | 'bridgePriority' | 'configIp'; key: string },
    value: string | number
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const hostConfig = { ...newLinks[hostIndex] };

      if (typeof field === 'string') {
        // กรณี field เป็น string ปกติ (เช่น 'selectedHost' หรือ 'deviceType')
        (hostConfig as any)[field] = value;

        // ถ้า command เปลี่ยนเป็น 'vlan' ให้ initialize vlanData
        if (field === 'selectedCommand' && value === 'vlan') {
          hostConfig.vlanData = {
            vlanId: '',
            vlanName: '',
            ipAddress: '',
            cidr: 24,
            interface: '',
            mode: '',
          };
        }

        // ถ้า command เปลี่ยนเป็น 'bridge_priority' ให้ initialize bridgePriority
        if (field === 'selectedCommand' && value === 'bridge_priority') {
          hostConfig.bridgePriority = {
            vlan: 1, // เริ่มต้นเป็น VLAN ID แรก
            priority: 4096, // ค่าเริ่มต้น
          };
        }

        // ถ้า command เปลี่ยนเป็น 'config_ip_router' ให้ initialize configIp
        if (field === 'selectedCommand' && value === 'config_ip_router') {
          hostConfig.configIp = {
            interface: '',
            ipAddress: '',
            cidr: 24,
          };
        }

        // ถ้า command เปลี่ยนเป็นอื่นๆ หรือไม่เลือก command ให้ลบค่าเดิม
        if (
          field === 'selectedCommand' &&
          !['vlan', 'bridge_priority', 'config_ip_router'].includes(value as string)
        ) {
          delete hostConfig.vlanData;
          delete hostConfig.bridgePriority;
          delete hostConfig.configIp;
        }

        // ถ้า DeviceType เปลี่ยน, reset selectedHost และ command
        if (field === 'deviceType') {
          hostConfig.selectedHost = '';
          hostConfig.selectedCommand = '';
          delete hostConfig.vlanData;
          delete hostConfig.bridgePriority;
          delete hostConfig.configIp;
        }
      } else {
        // กรณี field เป็น group (เช่น group = 'vlanData', key = 'vlanId')
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
        }
      }

      newLinks[hostIndex] = hostConfig;
      return newLinks;
    });
  };

  // ----------------------------------------------------------------
  // ฟังก์ชันดึง list ของ interface ใน host
  // ----------------------------------------------------------------
  const getInterfacesForHost = (hostname: string) => {
    const host = combinedHosts.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // ----------------------------------------------------------------
  // ปุ่ม Add HostConfig
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // ปุ่ม Remove HostConfig
  // ----------------------------------------------------------------
  const handleRemoveHost = (hostIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== hostIndex));
  };

  // ----------------------------------------------------------------
  // Submit ทั้งหมด
  // ----------------------------------------------------------------
  const handleSubmitAll = () => {
    setError('');

    // ตรวจสอบว่ามี HostConfig ไหนที่ยังเลือกไม่ครบหรือไม่
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link.deviceType || !link.selectedHost || !link.selectedCommand) {
        setError(`Please select device type, host, and command for all entries.`);
        return;
      }

      // ตรวจสอบข้อมูลเพิ่มเติมสำหรับแต่ละ command
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
    }

    // สร้าง request data
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
        <li className="center"><a href="/topology">Topology</a></li>
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

                    {/* เลือก Host */}
                    <div className="host-selection__dropdown-group">
                      <label>Select Host:</label>
                      <select
                        className="host-selection__dropdown"
                        value={link.selectedHost}
                        onChange={(e) => handleHostChange(index, 'selectedHost', e.target.value)}
                        disabled={!link.deviceType} // disable ถ้ายังไม่ได้เลือก DeviceType
                      >
                        <option value="">-- Select a Host --</option>
                        <option value="test">test</option>
                        {!loading &&
                          combinedHosts
                            .filter((host) => host.deviceType === link.deviceType)
                            .map((host: DropdownOption) => (
                              <option key={host.hostname} value={host.hostname}>
                                {host.hostname}
                              </option>
                            ))}
                      </select>
                      {/* {loading ? <Spinner color="primary" size="large" /> : null} */}
                    </div>

                    {/* เลือก Command */}
                    <div className="host-selection__dropdown-group">
                      <label>Select Command:</label>
                      <select
                        className="host-selection__dropdown"
                        value={link.selectedCommand}
                        onChange={(e) => handleHostChange(index, 'selectedCommand', e.target.value)}
                        disabled={!link.selectedHost} // disable ถ้ายังไม่ได้เลือก Host
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
                  {/* ถ้าเลือก command = vlan */}
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
                                <label>CIDR:</label>
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

                  {/* ถ้าเลือก command = bridge_priority */}
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
                          {/* สร้าง option จาก 0 ถึง 4096 ด้วยขั้นตอน 256 */}
                          {Array.from({ length: 16 }, (_, i) => i * 4096).map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ถ้าเลือก command = config_ip_router */}
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
                        <label>CIDR:</label>
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
