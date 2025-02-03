import React, { useState, useEffect } from 'react';
import './Bar.css';
import './Host.css';
import './Popup.css'; // สมมติว่ามีไฟล์ CSS สำหรับ Popup
import { ArrowLeftFromLine, Menu } from 'lucide-react';

function Hosts() {
  const [hosts, setHosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); // สำหรับการค้นหา
  const [showAddHostPopup, setShowAddHostPopup] = useState(false);
  const [formData, setFormData] = useState({
    deviceType: 'switch',
    hostname: '',
    ipAddress: '',
    username: '',
    password: '',
    enablePassword: '',
  });
  const [ipError, setIpError] = useState('');
  const [isNavOpen, setIsNavOpen] = useState(() => {
      const savedNavState = localStorage.getItem('isNavOpen');
      return savedNavState === 'true';  // Convert to boolean
    });
  // -------------------------
  // State สำหรับ Add Group
  // -------------------------
  const [showAddGroupPopup, setShowAddGroupPopup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedHostnames, setSelectedHostnames] = useState([]);
  const [groupError, setGroupError] = useState('');

  // -------------------------
  // State สำหรับ Delete Group
  // -------------------------
  const [groupToDelete, setGroupToDelete] = useState(null);

  // -------------------------
  // State สำหรับ Inventory Popup
  // -------------------------
  const [showInventoryPopup, setShowInventoryPopup] = useState(false);

  // -------------------------
  // State สำหรับจัดการกลุ่มที่ถูกเลือกในการสร้าง Inventory
  // -------------------------
  const [selectedGroup, setSelectedGroup] = useState(null);

  useEffect(() => {
    fetchHosts();
  }, []);

  useEffect(() => {
      localStorage.setItem('isNavOpen', isNavOpen.toString());
    }, [isNavOpen]);

  const fetchHosts = async () => {
    try {
      const response = await fetch('/api/get_hosts');
      if (response.ok) {
        const data = await response.json();
        setHosts(data);
      } else {
        console.error('Failed to fetch hosts');
      }
    } catch (err) {
      console.error('Error fetching hosts:', err);
    }
  };

  // -------------------------
  // ฟังก์ชันจัดการการเปลี่ยนแปลงในฟอร์ม Add Host
  // -------------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'ipAddress') {
      validateIp(value);
    }
  };

  // -------------------------
  // ฟังก์ชันตรวจสอบ IP Address
  // -------------------------
  const validateIp = (ip) => {
    const ipRegex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    if (!ipRegex.test(ip)) {
      setIpError('Please enter a valid IP address');
    } else {
      setIpError('');
    }
  };

  // -------------------------
  // ฟังก์ชันบันทึก Host ใหม่
  // -------------------------
  const handleSaveHost = async () => {
    if (ipError) {
      return;
    }

    try {
      const response = await fetch('/api/add_host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newHost = await response.json();
        setHosts((prev) => [...prev, newHost]);
        setShowAddHostPopup(false);
      } else {
        console.error('Failed to save host');
      }
    } catch (error) {
      console.error('Error saving host:', error);
    }
  };

  // -------------------------
  // ฟังก์ชันลบ Host
  // -------------------------
  const handleDeleteHost = async (hostname) => {
    try {
      const response = await fetch('/api/delete_host', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname }),
      });

      if (response.ok) {
        setHosts((prev) => prev.filter((host : any) => host.hostname !== hostname));
      } else {
        console.error('Failed to delete host');
      }
    } catch (error) {
      console.error('Error deleting host:', error);
    }
  };

  // -------------------------
  // ฟังก์ชันเปิด Popup Add Inventory
  // -------------------------
  const handleCreateInventory = async () => {
    if (!selectedGroup) {
      alert("Please select a group to include in the inventory.");
      return;
    }

    try {
      const response = await fetch('/api/create_inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: [selectedGroup] }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        setShowInventoryPopup(true);
      } else {
        const errorData = await response.json();
        alert(`Failed to create inventory: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating inventory:', error);
      alert('An error occurred while creating the inventory.');
    }
  };

  const closeInventoryPopup = () => {
    setShowInventoryPopup(false); // ซ่อน Popup
  };

  // -------------------------
  // ฟังก์ชันเปิด Popup Add Group
  // -------------------------
  const handleOpenAddGroupPopup = () => {
    setNewGroupName('');
    setSelectedHostnames([]);
    setGroupError('');
    setShowAddGroupPopup(true);
  };

  const closeAddGroupPopup = () => {
    setShowAddGroupPopup(false);
  };

  // -------------------------
  // ฟังก์ชันจัดการ Checkbox สำหรับเลือก Hosts ใน Group
  // -------------------------
  const handleCheckboxChange = (hostname) => {
    setSelectedHostnames((prevSelected) => {
      if (prevSelected.includes(hostname)) {
        // ถ้ามีอยู่แล้ว => เอาออก
        return prevSelected.filter((h) => h !== hostname);
      } else {
        // ถ้ายังไม่มี => เพิ่ม
        return [...prevSelected, hostname];
      }
    });
  };

  // -------------------------
  // ฟังก์ชันบันทึก Group
  // -------------------------
  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) {
      setGroupError('Group name is required.');
      return;
    }

    if (selectedHostnames.length === 0) {
      setGroupError('Please select at least one host.');
      return;
    }

    try {
      const response = await fetch('/api/add_group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_name: newGroupName,
          hostnames: selectedHostnames
        })
      });

      if (response.ok) {
        alert('Group added successfully!');
        // รีเฟรชข้อมูล hosts เพื่อแสดง Group ใหม่
        await fetchHosts();
        setShowAddGroupPopup(false);
      } else {
        const errorData = await response.json();
        alert(`Failed to add group: ${errorData.error || 'Unknown error'}`);
        console.error('Failed to add group');
      }
    } catch (error) {
      console.error('Error adding group:', error);
      alert('An error occurred while adding the group.');
    }
  };

  // -------------------------
  // ฟังก์ชันลบ Group
  // -------------------------
  const handleDeleteGroup = async (groupName) => {
    if (!window.confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/delete_group', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: groupName }),
      });

      if (response.ok) {
        alert('Group deleted successfully!');
        // รีเฟรชข้อมูล hosts เพื่ออัปเดตการแสดงผล
        await fetchHosts();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete group: ${errorData.error || 'Unknown error'}`);
        console.error('Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('An error occurred while deleting the group.');
    }
  };

  // -------------------------
  // ฟังก์ชันจัดการการเลือกกลุ่มในการสร้าง Inventory
  // -------------------------
  // เนื่องจากเป็นการเลือกกลุ่มเดียว เราจึงไม่ต้องมีฟังก์ชันแยกต่างหาก

  // -------------------------
  // ฟังก์ชันจัดการการเลือกกลุ่มในการสร้าง Inventory (สำหรับ Radio Button)
  // -------------------------
  const handleGroupSelect = (groupName) => {
    setSelectedGroup(groupName);
  };

  // -------------------------
  // ฟังก์ชันจัดการการค้นหา
  // -------------------------
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // -------------------------
  // กรอง Hosts ตามการค้นหา
  // -------------------------
  const filteredHosts = hosts.filter((host) =>
    host.hostname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // -------------------------
  // สร้าง Mapping ของ Groups
  // -------------------------
  const groupMapping = {};

  filteredHosts.forEach((host) => {
    if (host.groups && host.groups.length > 0) {
      host.groups.forEach((group) => {
        if (!groupMapping[group]) {
          groupMapping[group] = [];
        }
        groupMapping[group].push(host);
      });
    }
  });

  // -------------------------
  // เพิ่ม "All Devices" กลุ่ม
  // -------------------------
  groupMapping['All Devices'] = filteredHosts;

  // -------------------------
  // State สำหรับการเปิด/ปิดกลุ่ม
  // -------------------------
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (groupName) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  // -------------------------
  // Render Popup Add Group
  // -------------------------
  const renderAddGroupPopup = () => {
    if (!showAddGroupPopup) return null;
    return (
      <div className="popup-overlay">
        <div className="popup-content">
          <h2>Add Group</h2>
          <label>
            Group Name:
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter group name"
            />
          </label>
          <div className="hosts-checkbox-container">
            <h3>Select Hosts:</h3>
            <ul className="hosts-checkbox-list">
              {hosts.map((host) => (
                <li key={host.hostname}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedHostnames.includes(host.hostname)}
                      onChange={() => handleCheckboxChange(host.hostname)}
                    />
                    {host.hostname}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {groupError && <p className="error-text">{groupError}</p>}
          <div className="popup-buttons">
            <button onClick={handleSaveGroup} className="save-btn">Save Group</button>
            <button onClick={closeAddGroupPopup} className="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------
  // Render Popup Add Host
  // -------------------------
  const renderAddHostPopup = () => {
    if (!showAddHostPopup) return null;
    return (
      <div className="popup-overlay">
        <div className="popup-content">
          <h2>Add Host</h2>
          <label>
            Device Type:
            <select name="deviceType" value={formData.deviceType} onChange={handleInputChange}>
              <option value="switch">Switch</option>
              <option value="router">Router</option>
            </select>
          </label>
          <label>
            Hostname:
            <input
              type="text"
              name="hostname"
              value={formData.hostname}
              onChange={handleInputChange}
              placeholder="Enter hostname"
            />
          </label>
          <label>
            IP Address:
            <input
              type="text"
              name="ipAddress"
              value={formData.ipAddress}
              onChange={handleInputChange}
              style={{ borderColor: ipError ? 'red' : '#ccc' }}
              placeholder="Enter IP address"
            />
            {ipError && <span className="error-text">{ipError}</span>}
          </label>
          <label>
            Username:
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter username"
            />
          </label>
          <label>
            Password:
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter password"
            />
          </label>
          <label>
            Enable Password:
            <input
              type="password"
              name="enablePassword"
              value={formData.enablePassword}
              onChange={handleInputChange}
              placeholder="Enter enable password"
            />
          </label>

          <div className="popup-buttons">
            <button onClick={handleSaveHost} disabled={ipError} className="save-btn">Save Host</button>
            <button onClick={() => setShowAddHostPopup(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------
  // Render Popup Inventory Created
  // -------------------------
  const renderInventoryPopup = () => {
    if (!showInventoryPopup) return null;
    return (
      <div className="popup-overlay">
        <div className="popup-content">
          <p>Inventory has been created!</p>
          <button className="close-btn" onClick={closeInventoryPopup}>Close</button>
        </div>
      </div>
    );
  };

  // -------------------------
  // Render Confirmation Popup for Delete Group
  // -------------------------
  const renderDeleteGroupConfirmation = () => {
    if (!groupToDelete) return null;
    return (
      <div className="popup-overlay">
        <div className="popup-content">
          <h2>Delete Group</h2>
          <p>Are you sure you want to delete the group "{groupToDelete}"?</p>
          <div className="popup-buttons">
            <button onClick={() => handleDeleteGroup(groupToDelete)} className="save-btn">Yes, Delete</button>
            <button onClick={() => setGroupToDelete(null)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <div className={`nav-links-container ${isNavOpen ? "" : "closed"}`}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: '10px', paddingTop: '10px'  }}>
          <button
            style={{
              marginBottom: '16px',
              padding: '8px',
              color: '#7b7b7b',
              borderRadius: '8px',
              zIndex: 50,
              border: 'none',
              background: '#f5f7f9'
            }}
            onClick={() => setIsNavOpen(false)}
          >
            <ArrowLeftFromLine size={24} />
          </button>
          <img src="/easible-name.png" alt="" className="dashboard-icon" />
        </div>
        <ul className="nav-links">
          {/* <img src="/easible-name.png" alt='Logo' className="dashboard-icon" /> */}
          <li className="center"><a href="/dashboard">Dashboard</a></li>
          <li className="center"><a href="/hosts" style={{ color: '#8c94dc' }}>Devices</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/topology">Lab Check</a></li>
        </ul>
      </div>

      {/* -------------------------
          เนื้อหา (Content)
      ------------------------- */}
      <div className={`content ${isNavOpen ? "expanded" : "full-width"}`}>
        <div className='content-topic'>
          {!isNavOpen && (
            <button
              style={{
                padding: '8px',
                color: 'black',
                borderRadius: '8px',
                zIndex: 50,
                border: 'none',
                background: 'white',
                marginRight: '8px'
              }}
              onClick={() => setIsNavOpen(true)}
            >
              <Menu size={24} />
            </button>
          )}     
          Hosts</div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by hostname..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        {/* -------------------------
            ตาราง Hosts แบ่งตาม Groups
        ------------------------- */}
        <div className="groups-container">
          {Object.keys(groupMapping).map((group) => (
            <div key={group} className="group-section">
              <div className="group-header">
                <div>
                  <input
                    type="radio"
                    name="selectedGroup"
                    value={group}
                    checked={selectedGroup === group}
                    onChange={() => handleGroupSelect(group)}
                  />
                  <h3
                    className="group-heading"
                    onClick={() => toggleGroup(group)}
                    style={{ cursor: 'pointer', display: 'inline', marginLeft: '8px' }}
                  >
                    {group}
                  </h3>
                </div>
                {/* ไม่แสดง "All Devices" เพื่อไม่ให้มีปุ่มลบกลุ่ม */}
                {group !== 'All Devices' && (
                  <button
                    className="delete-group-btn"
                    onClick={() => setGroupToDelete(group)}
                  >
                    Delete Group
                  </button>
                )}
              </div>
              {/* แสดงตาราง Hosts ถ้ากลุ่มไม่ถูกปิด */}
              {!collapsedGroups[group] && (
                <table className="hosts-table">
                  <thead>
                    <tr>
                      <th>Hostname</th>
                      <th>Device Type</th>
                      <th>IP Address</th>
                      <th>Username</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupMapping[group].map((host) => (
                      <tr key={`${group}-${host.id}`}>
                        <td>{host.hostname}</td>
                        <td>{host.deviceType}</td>
                        <td>{host.ipAddress}</td>
                        <td>{host.username}</td>
                        <td>
                          <button onClick={() => handleDeleteHost(host.hostname)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>

        {/* -------------------------
            ปุ่ม Add Host, Add Group และ Create Inventory
        ------------------------- */}
        <div className="button-hosts">
          <button className="green-round" onClick={() => setShowAddHostPopup(true)}>Add Host</button>
          <button className="purple-round" onClick={handleCreateInventory}>Create Inventory</button>
          <button className="blue-round" onClick={handleOpenAddGroupPopup}>Add Group</button>

          {/* Popup สำหรับ Inventory Created */}
          {renderInventoryPopup()}
        </div>

        {/* -------------------------
            Popup สำหรับ Add Host
        ------------------------- */}
        {renderAddHostPopup()}

        {/* -------------------------
            Popup สำหรับ Add Group
        ------------------------- */}
        {renderAddGroupPopup()}

        {/* -------------------------
            Popup สำหรับ Delete Group Confirmation
        ------------------------- */}
        {renderDeleteGroupConfirmation()}
      </div>
    </div>
  );
}

export default Hosts;
