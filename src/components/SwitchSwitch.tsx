import React, { useState, useEffect } from 'react';
import './Bar.css';
import './SwitchSwitch.css';
import Spinner from './bootstrapSpinner.tsx';

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
  vlanId1?: string;
  vlanId2?: string;
  vlanName1?: string;
  vlanName2?: string;
  ipAddress1?: string;
  ipAddress2?: string;
  subnetMask1?: string;
  subnetMask2?: string;
  interface1?: string;
  interface2?: string;
};

type BridgePriorityData = {
  vlan: string;
  priority1: string;
  priority2: string;
};

// ใช้ index เป็นตัวชี้เพื่อไม่ต้องมี id
type LinkConfig = {
  selectedHost1: string;
  selectedHost2: string;
  selectedCommand: string;
  selectedInterface1: string;
  selectedInterface2: string;
  switchportMode: string;
  vlanData: VlanData;
  bridgePriority: BridgePriorityData;
  commonVlans: string[];
};

function SwitchSwitch() {
  const [hosts, setHosts] = useState<DropdownOption[]>([]);
  const [interfaceData, setInterfaceData] = useState<InterfaceData[]>([]);
  const [links, setLinks] = useState<LinkConfig[]>([]);

  const [vlans, setVlans] = useState<{ [key: string]: string[] }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  // คำสั่งที่มีให้เลือก
  const commands = [
    { label: 'Switchport', value: 'switchport' },
    { label: 'Configure VLAN', value: 'vlan' },
    { label: 'Bridge Priority', value: 'bridge_priority' },
  ];

  // useEffect: ดึงข้อมูลจาก backend
  useEffect(() => {
    setLoading(true);
    fetch('/api/show_detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
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

        const tempVlans: { [key: string]: string[] } = {};
        secondHalf.forEach((host: any) => {
          tempVlans[host.hostname] = host.vlan_ids || [];
        });
        setVlans(tempVlans);

        // เริ่มด้วยลิงก์เปล่า 1 ลิงก์
        setLinks([
          {
            selectedHost1: '',
            selectedHost2: '',
            selectedCommand: '',
            selectedInterface1: '',
            selectedInterface2: '',
            switchportMode: '',
            vlanData: {
              vlanId1: '',
              vlanName1: '',
              ipAddress1: '',
              subnetMask1: '',
              vlanId2: '',
              vlanName2: '',
              ipAddress2: '',
              subnetMask2: '',
              interface1: '',
              interface2: '',
            },
            bridgePriority: {
              vlan: '',
              priority1: '',
              priority2: '',
            },
            commonVlans: [],
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ----------------------------------------------------------------
  // ฟังก์ชันเปลี่ยนค่าทั่วไปใน Link
  // ----------------------------------------------------------------
  const handleLinkChange = (
    linkIndex: number,
    field: keyof LinkConfig | { group: 'vlanData' | 'bridgePriority'; key: string },
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const link = newLinks[linkIndex];

      if (typeof field === 'string') {
        // กรณี field เป็น string ปกติ (เช่น 'selectedHost1')
        (link as any)[field] = value;
      } else {
        // กรณี field เป็น group (เช่น group = 'vlanData', key = 'vlanId1')
        if (field.group === 'vlanData') {
          link.vlanData = {
            ...link.vlanData,
            [field.key]: value,
          };
        } else if (field.group === 'bridgePriority') {
          link.bridgePriority = {
            ...link.bridgePriority,
            [field.key]: value,
          };
        }
      }

      newLinks[linkIndex] = { ...link };
      return newLinks;
    });
  };

  // ----------------------------------------------------------------
  // ฟังก์ชันเปลี่ยนโฮสต์ แล้วคำนวณ common VLAN (เฉพาะ bridge_priority)
  // ----------------------------------------------------------------
  const handleHostChange = (
    linkIndex: number,
    whichHost: 'selectedHost1' | 'selectedHost2',
    hostValue: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const link = { ...newLinks[linkIndex] };
      link[whichHost] = hostValue;

      // ถ้า command เป็น bridge_priority แล้วโฮสต์ครบ => หา common vlans
      if (link.selectedCommand === 'bridge_priority' && link.selectedHost1 && link.selectedHost2) {
        const host1Vlans = vlans[link.selectedHost1] || [];
        const host2Vlans = vlans[link.selectedHost2] || [];
        link.commonVlans = host1Vlans.filter((vlan) => host2Vlans.includes(vlan));
        link.bridgePriority.vlan = ''; // reset ค่า vlan ที่เลือก
      }

      newLinks[linkIndex] = link;
      return newLinks;
    });
  };

  // ----------------------------------------------------------------
  // ฟังก์ชันเปลี่ยน command
  // ----------------------------------------------------------------
  const handleCommandChange = (linkIndex: number, commandValue: string) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const link = { ...newLinks[linkIndex] };
      link.selectedCommand = commandValue;

      // ถ้า command = bridge_priority และโฮสต์ครบ => หา common vlan
      if (commandValue === 'bridge_priority' && link.selectedHost1 && link.selectedHost2) {
        const host1Vlans = vlans[link.selectedHost1] || [];
        const host2Vlans = vlans[link.selectedHost2] || [];
        link.commonVlans = host1Vlans.filter((vlan) => host2Vlans.includes(vlan));
      } else {
        // ถ้าเป็น command อื่นๆ, clear
        link.commonVlans = [];
      }
      // reset ค่า vlan ใน bridgePriority
      link.bridgePriority.vlan = '';
      newLinks[linkIndex] = link;
      return newLinks;
    });
  };

  // ----------------------------------------------------------------
  // ฟังก์ชันดึง list ของ interface ใน host
  // ----------------------------------------------------------------
  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // ----------------------------------------------------------------
  // ปุ่ม Add Link
  // ----------------------------------------------------------------
  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        selectedHost1: '',
        selectedHost2: '',
        selectedCommand: '',
        selectedInterface1: '',
        selectedInterface2: '',
        switchportMode: '',
        vlanData: {
          vlanId1: '',
          vlanName1: '',
          ipAddress1: '',
          subnetMask1: '',
          vlanId2: '',
          vlanName2: '',
          ipAddress2: '',
          subnetMask2: '',
          interface1: '',
          interface2: '',
        },
        bridgePriority: {
          vlan: '',
          priority1: '',
          priority2: '',
        },
        commonVlans: [],
      },
    ]);
  };

  // ----------------------------------------------------------------
  // ปุ่ม Remove Link
  // ----------------------------------------------------------------
  const handleRemoveLink = (linkIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== linkIndex));
  };

  // ----------------------------------------------------------------
  // Submit ทั้งหมด
  // ----------------------------------------------------------------
  const handleSubmitAll = () => {
    setError('');

    // ตรวจสอบว่ามีลิงก์ไหนที่ยังเลือกไม่ครบหรือไม่
    for (let link of links) {
      if (!link.selectedHost1 || !link.selectedHost2 || !link.selectedCommand) {
        setError('Please select hosts and command for all links before submitting.');
        return;
      }
    }

    // สร้าง request data
    const requestData = links.map((link) => ({
      hostname1: link.selectedHost1,
      hostname2: link.selectedHost2,
      command: link.selectedCommand,
      vlanData: {
        ...(link.vlanData.vlanId1 && link.vlanData.vlanName1 && {
          vlanId1: link.vlanData.vlanId1,
          vlanName1: link.vlanData.vlanName1,
          ipAddress1: link.vlanData.ipAddress1,
          subnetMask1: link.vlanData.subnetMask1,
          interface1: link.vlanData.interface1 || link.selectedInterface1,
        }),
        ...(link.vlanData.vlanId2 && link.vlanData.vlanName2 && {
          vlanId2: link.vlanData.vlanId2,
          vlanName2: link.vlanData.vlanName2,
          ipAddress2: link.vlanData.ipAddress2,
          subnetMask2: link.vlanData.subnetMask2,
          interface2: link.vlanData.interface2 || link.selectedInterface2,
        }),
      },
      switchportMode: link.switchportMode,
      interface1: link.selectedInterface1,
      interface2: link.selectedInterface2,
      bridgePriority: {
        vlan: link.bridgePriority.vlan,
        priority1: link.bridgePriority.priority1,
        priority2: link.bridgePriority.priority2,
      },
    }));

    console.log('Sending data to backend:', requestData);

    fetch('/api/create_playbook', {
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
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/topology">Topology</a></li>
      </ul>

      <div className="content">
        <div className='content-topic'>
          Configuration <span className='content-topic-small'>(Switch-Switch)</span>
        </div>
        <div className="content-board">
          {/* ปุ่มเพิ่มลิงก์ใหม่ */}
          <div className="all-links">
          

          {/* Render ฟอร์มสำหรับแต่ละลิงก์ */}
          {links.map((link, index) => (
            <div
              key={index}
              className="switch-switch"
            >
              <h3>Link #{index + 1}</h3>

              {/* ปุ่มลบลิงก์ */}
              {links.length > 1 && (
                <button
                  onClick={() => handleRemoveLink(index)}
                  style={{ color: 'red', marginBottom: '1rem' }}
                >
                  Remove This Link
                </button>
              )}

              <div className="host-selection-container">
                <div className="host-selection__hosts">
                  <div className="host-selection__dropdown-group">
                    <label>Select Host (SW1):</label>
                    <div className="manu-liver">
                      <select
                        className="host-selection__dropdown"
                        onChange={(e) => handleHostChange(index, 'selectedHost1', e.target.value)}
                        value={link.selectedHost1}
                      >
                        <option value="">-- Select a Host --</option>
                        <option value="test">test</option>
                        {!loading &&
                          hosts.map((host: DropdownOption) => (
                            <option key={host.hostname} value={host.hostname}>
                              {host.hostname}
                            </option>
                            
                          ))}
                      </select>
                      
                    </div>
                  </div>

                  <div className="host-selection__dropdown-group">
                    <label>Select Host (SW2):</label>
                    <select
                      className="host-selection__dropdown"
                      onChange={(e) => handleHostChange(index, 'selectedHost2', e.target.value)}
                      value={link.selectedHost2}
                    >
                      <option value="">-- Select a Host --</option>
                      <option value="test">test</option>
                      {hosts.map((host: DropdownOption) => (
                        <option key={host.hostname} value={host.hostname}>
                          {host.hostname}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="host-selection__commands">
                  <div className="host-selection__dropdown-group">
                    <label>Select Command:</label>
                    <select
                      className="host-selection__dropdown"
                      value={link.selectedCommand}
                      onChange={(e) => handleCommandChange(index, e.target.value)}
                    >
                      <option value="">-- Select a Command --</option>
                      {commands.map((command) => (
                        <option key={command.value} value={command.value}>
                          {command.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ถ้าเลือก command = switchport */}
              {link.selectedHost1 && link.selectedHost2 && link.selectedCommand === 'switchport' && (
                <div className="host-selection__switchport-configuration">
                  <div className="host-selection__dropdown-group">
                    <label>Select Interface for {link.selectedHost1}:</label>
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

                  <div className="host-selection__dropdown-group">
                    <label>Select Interface for {link.selectedHost2}:</label>
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

                  <div className="host-selection__dropdown-group">
                    <label>Switchport Mode:</label>
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
              )}

              {/* ถ้าเลือก command = vlan */}
              {link.selectedHost1 && link.selectedHost2 && link.selectedCommand === 'vlan' && (
                <div className="host-selection__vlan-configuration">
                  <div className="host-selection__dropdown-group">
                    <label>VLAN ID (for {link.selectedHost1}):</label>
                    <input
                      type="text"
                      value={link.vlanData.vlanId1}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'vlanId1' }, e.target.value)
                      }
                      placeholder="Enter VLAN ID"
                    />

                    <label>VLAN Name (for {link.selectedHost1}):</label>
                    <input
                      type="text"
                      value={link.vlanData.vlanName1}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'vlanName1' }, e.target.value)
                      }
                      placeholder="Enter VLAN Name"
                    />

                    <label>IP Address (for {link.selectedHost1}):</label>
                    <input
                      type="text"
                      value={link.vlanData.ipAddress1}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'ipAddress1' }, e.target.value)
                      }
                      placeholder="Enter IP Address"
                    />

                    <label>Subnet Mask (1-32 for {link.selectedHost1}):</label>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={link.vlanData.subnetMask1}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'subnetMask1' }, e.target.value)
                      }
                      placeholder="Enter Subnet Mask"
                    />

                    <label>Interface (for {link.selectedHost1}):</label>
                    <select
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'interface1' }, e.target.value)
                      }
                      value={link.vlanData.interface1}
                    >
                      <option value="">-- Select Interface --</option>
                      {getInterfacesForHost(link.selectedHost1).map((intf) => (
                        <option key={intf.interface} value={intf.interface}>
                          {intf.interface} ({intf.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="host-selection__dropdown-group">
                    <label>VLAN ID (for {link.selectedHost2}):</label>
                    <input
                      type="text"
                      value={link.vlanData.vlanId2}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'vlanId2' }, e.target.value)
                      }
                      placeholder="Enter VLAN ID"
                    />

                    <label>VLAN Name (for {link.selectedHost2}):</label>
                    <input
                      type="text"
                      value={link.vlanData.vlanName2}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'vlanName2' }, e.target.value)
                      }
                      placeholder="Enter VLAN Name"
                    />

                    <label>IP Address (for {link.selectedHost2}):</label>
                    <input
                      type="text"
                      value={link.vlanData.ipAddress2}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'ipAddress2' }, e.target.value)
                      }
                      placeholder="Enter IP Address"
                    />

                    <label>Subnet Mask (1-32 for {link.selectedHost2}):</label>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={link.vlanData.subnetMask2}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'subnetMask2' }, e.target.value)
                      }
                      placeholder="Enter Subnet Mask"
                    />

                    <label>Interface (for {link.selectedHost2}):</label>
                    <select
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'vlanData', key: 'interface2' }, e.target.value)
                      }
                      value={link.vlanData.interface2}
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
              )}

              {/* ถ้าเลือก command = bridge_priority */}
              {link.selectedHost1 && link.selectedHost2 && link.selectedCommand === 'bridge_priority' && (
                <div className="host-selection__bridge-priority-configuration">
                  <div className="host-selection__dropdown-group">
                    <label>Select VLAN:</label>
                    <select
                      className="host-selection__dropdown"
                      value={link.bridgePriority.vlan}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'bridgePriority', key: 'vlan' }, e.target.value)
                      }
                    >
                      <option value="">-- Select VLAN --</option>
                      {link.commonVlans.map((vlan) => (
                        <option key={vlan} value={vlan}>
                          {vlan}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="host-selection__dropdown-group">
                    <label>Bridge Priority for {link.selectedHost1}:</label>
                    <input
                      type="text"
                      value={link.bridgePriority.priority1}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'bridgePriority', key: 'priority1' }, e.target.value)
                      }
                      placeholder="Enter priority (e.g., 4096)"
                    />
                  </div>

                  <div className="host-selection__dropdown-group">
                    <label>Bridge Priority for {link.selectedHost2}:</label>
                    <input
                      type="text"
                      value={link.bridgePriority.priority2}
                      onChange={(e) =>
                        handleLinkChange(index, { group: 'bridgePriority', key: 'priority2' }, e.target.value)
                      }
                      placeholder="Enter priority (e.g., 4096)"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          
        </div>
        <div className="line-container">
            <div className="line"></div>
            <button 
              onClick={handleAddLink} 
              className={`button-sw-sw-add ${loading ? 'loading' : ''}`} 
              // disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner color="white" size="small" /> {/* Spinner in front of the text */}
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
