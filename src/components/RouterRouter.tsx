import React, { useState, useEffect } from 'react';
import './Bar.css';
import './SwitchSwitch.css'; // สมมติ reuse style เดิม หรือเปลี่ยนชื่อไฟล์ใหม่
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
};

type InterfaceData = {
  hostname: string;
  interfaces: {
    interface: string;
    ip_address: string;
    status: string;
  }[];
};

type StaticRoute = {
  prefix: string;
  cidr: number;
  nextHop: string;
};

type LinkConfig = {
  selectedHost1: string;
  selectedHost2: string;
  selectedInterface1: string;
  selectedInterface2: string;
  ipAddress1: string;
  ipAddress2: string;
  cidr: string;
  selectedProtocol: string; // none, rip, ospf, static
  staticRoute1?: StaticRoute;
  staticRoute2?: StaticRoute;
};

function RouterRouter() {
  const [hosts, setHosts] = useState<DropdownOption[]>([]);
  const [interfaceData, setInterfaceData] = useState<InterfaceData[]>([]);
  const [links, setLinks] = useState<LinkConfig[]>([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState<boolean>(true);

  // protocol ที่มีให้เลือก
  const protocols = [
    { label: 'None (Only IP Address)', value: 'none' },
    { label: 'RIPv2', value: 'rip' },
    { label: 'OSPF', value: 'ospf' },
    { label: 'Static Route', value: 'static' },
  ];

  // useEffect: ดึงข้อมูล Hosts/Interfaces จาก backend
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
        }));
        setInterfaceData(iData);

        // เริ่มด้วยลิงก์เปล่า 1 link
        setLinks([
          {
            selectedHost1: '',
            selectedHost2: '',
            selectedInterface1: '',
            selectedInterface2: '',
            ipAddress1: '',
            ipAddress2: '',
            cidr: '24', // default เป็น /24
            selectedProtocol: 'none',
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ฟังก์ชันดึง interfaces ของ host
  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((h) => h.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // ฟังก์ชัน handle Add Link
  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        selectedHost1: '',
        selectedHost2: '',
        selectedInterface1: '',
        selectedInterface2: '',
        ipAddress1: '',
        ipAddress2: '',
        cidr: '24',
        selectedProtocol: 'none',
      },
    ]);
  };

  // ฟังก์ชัน handle Remove Link
  const handleRemoveLink = (index: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== index));
  };

  // ฟังก์ชันเปลี่ยนค่าใน link
  const handleChange = (
    index: number,
    field: keyof LinkConfig | { group: 'staticRoute1' | 'staticRoute2'; key: keyof StaticRoute },
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const link = { ...newLinks[index] };
  
      if (typeof field === 'string') {
        // กรณี field เป็น string ปกติ (เช่น 'selectedHost1')
        (link as any)[field] = value;
  
        // ถ้า protocol เปลี่ยนเป็น 'static' ให้ initialize staticRoute1 และ staticRoute2
        if (field === 'selectedProtocol' && value === 'static') {
          link.staticRoute1 = { prefix: '', cidr: 24, nextHop: '' };
          link.staticRoute2 = { prefix: '', cidr: 24, nextHop: '' };
        }
  
        // ถ้า protocol ไม่ใช่ 'static' ให้ลบ staticRoute1 และ staticRoute2
        if (field === 'selectedProtocol' && value !== 'static') {
          delete link.staticRoute1;
          delete link.staticRoute2;
        }
      } else {
        // กรณี field เป็น group (เช่น group = 'staticRoute1', key = 'prefix')
        if (field.group === 'staticRoute1') {
          link.staticRoute1 = {
            ...link.staticRoute1,
            [field.key]: value,
          };
        } else if (field.group === 'staticRoute2') {
          link.staticRoute2 = {
            ...link.staticRoute2,
            [field.key]: value,
          };
        }
      }
  
      newLinks[index] = link;
      return newLinks;
    });
  };  

  // ฟังก์ชัน Submit ทั้งหมด
  const handleSubmitAll = () => {
    setError('');
  
    // ตรวจว่าเลือก host, interface, ipAddress, cidr ครบหรือไม่
    for (let link of links) {
      if (
        !link.selectedHost1 ||
        !link.selectedHost2 ||
        !link.selectedInterface1 ||
        !link.selectedInterface2 ||
        !link.ipAddress1 ||
        !link.ipAddress2 ||
        !link.cidr
      ) {
        setError('Please fill all required fields for each link.');
        return;
      }
  
      if (link.selectedProtocol === 'static') {
        if (
          !link.staticRoute1 ||
          !link.staticRoute1.prefix ||
          !link.staticRoute1.cidr ||
          !link.staticRoute1.nextHop ||
          !link.staticRoute2 ||
          !link.staticRoute2.prefix ||
          !link.staticRoute2.cidr ||
          !link.staticRoute2.nextHop
        ) {
          setError('Please fill all Static Route fields for each link.');
          return;
        }
      }
    }
  
    // สร้าง payload ส่งไป backend
    const requestData = links.map((link) => ({
      hostname1: link.selectedHost1,
      hostname2: link.selectedHost2,
      interface1: link.selectedInterface1,
      interface2: link.selectedInterface2,
      ipAddress1: link.ipAddress1,
      ipAddress2: link.ipAddress2,
      cidr: link.cidr,
      protocol: link.selectedProtocol,
      ...(link.selectedProtocol === 'static' && link.staticRoute1 && link.staticRoute2
        ? { staticRoute1: link.staticRoute1, staticRoute2: link.staticRoute2 }
        : {}),
    }));
  
    console.log('Sending data to backend (router-router):', requestData);
  
    fetch('/api/create_playbook_rttort', {
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
        console.error('Error:', err);
      });
  };
  

  return (
    <div className="App">
      <ul className="nav-links">
        <img src="/easible-name.png" alt="" className="dashboard-icon" />
          <li className="center"><a href="/dashboard">Dashboard</a></li>
          <li className="center"><a href="/hosts">Hosts</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter" style={{ color: '#8c94dc' }}>router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/topology">Topology</a></li>
      </ul>

      <div className="content">
        <div className="content-topic">
          Configuration
          <span className="content-topic-small"> (Router-Router)</span>
        </div>
        <div className="content-board">
          <div className="all-links">
            {links.map((link, index) => (
            <div
              key={index}
              className="switch-switch"
            >
              <div className='link-index'>Link {index + 1}</div>

              <div className="content-section">
                <div className="host-selection-container">
                  <div className="host-selection__hosts">
                    <div className="host-selection__dropdown-group">
                      <label>Router1 (Host):</label>
                      <div className="host-selection__dropdown-container">
                      <select
                        className="host-selection__dropdown"
                        value={link.selectedHost1}
                        onChange={(e) =>
                          handleChange(index, 'selectedHost1', e.target.value)
                        }
                      >
                        <option value="">-- Select Router (Host1) --</option>
                        {!loading &&
                          hosts.map((host) => (
                            <option key={host.hostname} value={host.hostname}>
                              {host.hostname}
                            </option>
                          ))}
                      </select>
                      </div>
                      {/* {loading ? <Spinner color="primary" size="large" /> : null} */}
                    </div>

                    <div className="host-selection__dropdown-group">
                      <label>Router2 (Host):</label>
                      <select
                        className="host-selection__dropdown"
                        value={link.selectedHost2}
                        onChange={(e) =>
                          handleChange(index, 'selectedHost2', e.target.value)
                        }
                      >
                        <option value="">-- Select Router (Host2) --</option>
                        {hosts.map((host) => (
                          <option key={host.hostname} value={host.hostname}>
                            {host.hostname}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="host-selection__commands">
                    <div className="host-selection__dropdown-group">
                      <label>Interface of Router1:</label>
                      <select
                        className="host-selection__dropdown"
                        value={link.selectedInterface1}
                        onChange={(e) =>
                          handleChange(index, 'selectedInterface1', e.target.value)
                        }
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
                      <label>Interface of Router2:</label>
                      <select
                        className="host-selection__dropdown"
                        value={link.selectedInterface2}
                        onChange={(e) =>
                          handleChange(index, 'selectedInterface2', e.target.value)
                        }
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
                </div>
              </div>

              

              {/* กรอก IP Address ฝั่ง Router1, Router2 และ Subnet */}
              <div style={{ marginTop: '20px' }}>
                <div className="host-selection__dropdown-group">
                  <label>IP Address (Router1):</label>
                  <input
                    type="text"
                    className="host-selection__dropdown"
                    value={link.ipAddress1}
                    onChange={(e) =>
                      handleChange(index, 'ipAddress1', e.target.value)
                    }
                    placeholder="Enter IP for Router1"
                  />
                </div>

                <div className="host-selection__dropdown-group">
                  <label>IP Address (Router2):</label>
                  <input
                    type="text"
                    className="host-selection__dropdown"
                    value={link.ipAddress2}
                    onChange={(e) =>
                      handleChange(index, 'ipAddress2', e.target.value)
                    }
                    placeholder="Enter IP for Router2"
                  />
                </div>

                <div className="host-selection__dropdown-group">
                  <label>Subnet (CIDR):</label>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    className="host-selection__dropdown"
                    value={link.cidr}
                    onChange={(e) => handleChange(index, 'cidr', e.target.value)}
                    placeholder="24"
                  />
                </div>
              </div>

              {/* เลือก Protocol */}
              <div style={{ marginTop: '20px' }}>
                <label>Protocol:</label>
                <select
                  className="host-selection__dropdown"
                  value={link.selectedProtocol}
                  onChange={(e) =>
                    handleChange(index, 'selectedProtocol', e.target.value)
                  }
                >
                  {protocols.map((prot) => (
                    <option key={prot.value} value={prot.value}>
                      {prot.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ถ้าเลือก protocol = static */}
              {link.selectedProtocol === 'static' && (
              <>
                {/* Static Route for Host1 */}
                <div
                  className="host-selection__static-route-configuration"
                  style={{
                    marginTop: '20px',
                    background: 'linear-gradient(to bottom right, #eef6f9, #dcecf5)',
                    padding: '18px',
                    borderRadius: '10px',
                    border: '1px solid #c7dfe6',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <h4>Static Route Configuration for {link.selectedHost1}</h4>
                  <div className="host-selection__dropdown-group">
                    <label>Prefix (Host1):</label>
                    <input
                      type="text"
                      className="host-selection__dropdown"
                      value={link.staticRoute1?.prefix || ''}
                      onChange={(e) =>
                        handleChange(
                          index,
                          { group: 'staticRoute1', key: 'prefix' },
                          e.target.value
                        )
                      }
                      placeholder="Enter Prefix (e.g., 10.0.0.0)"
                    />
                  </div>
                    
                  <div className="host-selection__dropdown-group">
                    <label>CIDR (Host1):</label>
                    <input
                      type="text"
                      className="host-selection__dropdown"
                      value={link.staticRoute1?.cidr || ''}
                      onChange={(e) =>
                        handleChange(
                          index,
                          { group: 'staticRoute1', key: 'cidr' },
                          e.target.value
                        )
                      }
                      placeholder="Enter Subnet Mask (e.g., 255.255.255.0)"
                    />
                  </div>
                    
                  <div className="host-selection__dropdown-group">
                    <label>Next Hop (Host1):</label>
                    <input
                      type="text"
                      className="host-selection__dropdown"
                      value={link.staticRoute1?.nextHop || ''}
                      onChange={(e) =>
                        handleChange(
                          index,
                          { group: 'staticRoute1', key: 'nextHop' },
                          e.target.value
                        )
                      }
                      placeholder="Enter Next Hop IP Address"
                    />
                  </div>
                </div>
                    
                {/* Static Route for Host2 */}
                <div
                  className="host-selection__static-route-configuration"
                  style={{
                    marginTop: '20px',
                    background: 'linear-gradient(to bottom right, #eef6f9, #dcecf5)',
                    padding: '18px',
                    borderRadius: '10px',
                    border: '1px solid #c7dfe6',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <h4>Static Route Configuration for {link.selectedHost2}</h4>
                  <div className="host-selection__dropdown-group">
                    <label>Prefix (Host2):</label>
                    <input
                      type="text"
                      className="host-selection__dropdown"
                      value={link.staticRoute2?.prefix || ''}
                      onChange={(e) =>
                        handleChange(
                          index,
                          { group: 'staticRoute2', key: 'prefix' },
                          e.target.value
                        )
                      }
                      placeholder="Enter Prefix (e.g., 10.0.0.0)"
                    />
                  </div>
                    
                  <div className="host-selection__dropdown-group">
                    <label>CIDR (Host2):</label>
                    <input
                      type="text"
                      className="host-selection__dropdown"
                      value={link.staticRoute2?.cidr || ''}
                      onChange={(e) =>
                        handleChange(
                          index,
                          { group: 'staticRoute2', key: 'cidr' },
                          e.target.value
                        )
                      }
                      placeholder="Enter Subnet Mask (e.g., 255.255.255.0)"
                    />
                  </div>
                    
                  <div className="host-selection__dropdown-group">
                    <label>Next Hop (Host2):</label>
                    <input
                      type="text"
                      className="host-selection__dropdown"
                      value={link.staticRoute2?.nextHop || ''}
                      onChange={(e) =>
                        handleChange(
                          index,
                          { group: 'staticRoute2', key: 'nextHop' },
                          e.target.value
                        )
                      }
                      placeholder="Enter Next Hop IP Address"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="remove-link-container">
              {links.length > 1 && (
                <button
                  onClick={() => handleRemoveLink(index)}
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
                "+ Add Router-Router Link"
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

export default RouterRouter;
