import React, { useState, useEffect } from 'react';
import './Bar.css';
import './Host.css';
import HostsTable  from './hostTable.tsx';

function Hosts() {
  const [hosts, setHosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); // New state for search query
  const [showPopup, setShowPopup] = useState(false);
  const [formData, setFormData] = useState({
    deviceType: 'switch',
    hostname: '',
    ipAddress: '',
    username: '',
    password: '',
    enablePassword: '',
  });
  const [ipError, setIpError] = useState('');

  useEffect(() => {
    fetch('/api/get_hosts')
      .then((res) => res.json())
      .then((data) => setHosts(data))
      .catch((err) => console.error('Error fetching hosts:', err));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'ipAddress') {
      validateIp(value);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value); // Update search query state
  };

  const validateIp = (ip) => {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    if (!ipRegex.test(ip)) {
      setIpError('Please enter a valid IP address');
    } else {
      setIpError('');
    }
  };

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
        setShowPopup(false);
      } else {
        console.error('Failed to save host');
      }
    } catch (error) {
      console.error('Error saving host:', error);
    }
  };

  const handleDeleteHost = async (hostname) => {
    try {
      const response = await fetch('/api/delete_host', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname }),
      });

      if (response.ok) {
        setHosts((prev) => prev.filter((host) => host.hostname !== hostname));
      } else {
        console.error('Failed to delete host');
      }
    } catch (error) {
      console.error('Error deleting host:', error);
    }
  };

  const [showInventoryPopup, setShowInventoryPopup] = useState(false);

  const handleCreateInventory = async () => {
    // Your logic for creating an inventory goes here
    try {
      const response = await fetch('/api/create_inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // if (response.ok) {
      //   alert('Inventory created successfully!');
      // } else {
      //   console.error('Failed to create inventory');
      // }
    } catch (error) {
      console.error('Error creating inventory:', error);
    }
    
    console.log("Inventory created");
    setShowInventoryPopup(true); // Show the popup
  };

  const closePopup = () => {
    setShowInventoryPopup(false); // Hide the popup
  };

  // Filter hosts based on search query
  const filteredHosts = hosts.filter((host) =>
    host.hostname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="App">
      <div className="nav-links-container">
        <ul className="nav-links">
        <img src="/easible-name.png" alt='' className="dashboard-icon" />
          <li className="center"><a href="/dashboard">Dashboard</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/hosts">Hosts</a></li>
          <li className="center"><a href="/topology">Topology</a></li>
        </ul>
      </div>
      
      <div className='content'>
        <div className='content-topic'>Hosts</div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by hostname..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        {/* <HostsTable filteredHosts={filteredHosts} searchQuery={searchQuery} handleDeleteHost={handleDeleteHost} /> */}
        <table className="hosts-table">
          <thead>
            <tr>
              <th>Device Type</th>
              <th>Hostname</th>
              <th>IP Address</th>
              <th>Username</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredHosts.length > 0 ? (
              filteredHosts.map((host) => (
                <tr key={host.id}>
                  <td>{host.deviceType}</td>
                  <td>{host.hostname}</td>
                  <td>{host.ipAddress}</td>
                  <td>{host.username}</td>
                  <td>
                    <button onClick={() => handleDeleteHost(host.hostname)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: 'black' }}>
                  No results found for "{searchQuery}".
                </td>
              </tr>
            )}
          </tbody>
        </table>


        <div className="button-hosts">
          <button className="purple-round" onClick={() => setShowPopup(true)}>Add Host</button>
          <button className="purple-round" onClick={handleCreateInventory}>Create Inventory</button>

          {/* Popup component for Inventory Created */}
          {showInventoryPopup && (
            <div className="popup-inventory">
              <div className="popup-inventory-content">
                <p>Inventory has been created!</p>
                <button className="close-btn" onClick={closePopup}>Close</button>
              </div>
            </div>
          )}
        </div>

        {showPopup && (
          <div className="popup">
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
                {ipError && <span style={{ color: 'red' }}>{ipError}</span>}
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

              <button onClick={handleSaveHost} disabled={ipError} className="save-btn">Save Host</button>
              <button onClick={() => setShowPopup(false)} className="cancel-btn">Cancel</button>

            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}

export default Hosts;
