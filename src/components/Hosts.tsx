import React, { useState, useEffect } from 'react';
import './Bar.css';
import './Host.css';

function Hosts() {
  const [hosts, setHosts] = useState([]);
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

  // Fetch hosts from the backend
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

  const validateIp = (ip) => {
    // Basic regex for validating IP addresses
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    if (!ipRegex.test(ip)) {
      setIpError('Please enter a valid IP address');
    } else {
      setIpError('');
    }
  };

  const handleSaveHost = async () => {
    // Ensure no errors before saving
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

  // Handle creating inventory (POST request to backend)
  const handleCreateInventory = async () => {
    try {
      const response = await fetch('/api/create_inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        alert('Inventory created successfully!');
      } else {
        console.error('Failed to create inventory');
      }
    } catch (error) {
      console.error('Error creating inventory:', error);
    }
  };

  return (
    <div className="App">
      <ul className="nav-links">
      <li className="center"><a href="/dashboard">Dashboard</a></li>
        <li className="center"><a href="/jobs">Jobs</a></li>
        <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
        <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
        <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
        <li className="center"><a href="/hosts">Hosts</a></li>
        <li className="center"><a href="/topology">Topology</a></li>
      </ul>

      <table className="hosts-table">
        <thead>
          <tr>
            <th>Device Type</th>
            <th>Hostname</th>
            <th>IP Address</th>
            <th>Username</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {hosts.map((host) => (
            <tr key={host.id}>
              <td>{host.deviceType}</td>
              <td>{host.hostname}</td>
              <td>{host.ipAddress}</td>
              <td>{host.username}</td>
              <td>
                <button onClick={() => handleDeleteHost(host.hostname)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <button onClick={() => setShowPopup(true)}>Add Host</button>
        <button onClick={handleCreateInventory}>Create Inventory</button> {/* Create Inventory Button */}
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
              <input type="text" name="hostname" value={formData.hostname} onChange={handleInputChange} />
            </label>
            <label>
              IP Address:
              <input
                type="text"
                name="ipAddress"
                value={formData.ipAddress}
                onChange={handleInputChange}
                style={{ borderColor: ipError ? 'red' : '#ccc' }}
              />
              {ipError && <span style={{ color: 'red' }}>{ipError}</span>}
            </label>
            <label>
              Username:
              <input type="text" name="username" value={formData.username} onChange={handleInputChange} />
            </label>
            <label>
              Password:
              <input type="password" name="password" value={formData.password} onChange={handleInputChange} />
            </label>
            <label>
              Enable Password:
              <input type="password" name="enablePassword" value={formData.enablePassword} onChange={handleInputChange} />
            </label>
            <button onClick={handleSaveHost} disabled={ipError}>Save Host</button>
            <button onClick={() => setShowPopup(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hosts;
