import React, { useState, useEffect } from 'react';
import './Bar.css';
import './SwitchSwitch.css';


function SwitchSwitch() {
  const [hosts, setHosts] = useState([]);
  const [interfaceData, setInterfaceData] = useState([]);
  const [selectedHost1, setSelectedHost1] = useState('');
  const [selectedHost2, setSelectedHost2] = useState('');
  const [selectedInterface1, setSelectedInterface1] = useState('');
  const [selectedInterface2, setSelectedInterface2] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');
  const [vlanData, setVlanData] = useState({ vlanId: '', vlanName: '', ipAddress1: '', ipAddress2: '' });
  const [switchportMode, setSwitchportMode] = useState('');
  const [error, setError] = useState(null);

  const commands = [
    { label: 'Switchport', value: 'switchport' },
    { label: 'Configure OSPF', value: 'ospf' },
    { label: 'Configure EIGRP', value: 'eigrp' },
    { label: 'Configure VLAN', value: 'vlan' },
    { label: 'Custom Command', value: 'custom' },
  ];

  useEffect(() => {
    fetch('/api/show_ip_interface_brief', {
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

        const interfaceData = secondHalf.map((item) => ({
          hostname: item.hostname,
          interfaces: item.interfaces.map((interfaceItem) => ({
            interface: interfaceItem.interface,
            ip_address: interfaceItem.detail.ip_address,
            status: interfaceItem.detail.status,
          })),
        }));

        setInterfaceData(interfaceData);
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleSelectChange = (key, type, value) => {
    if (type === 'host') {
      if (key === 'host1') {
        setSelectedHost1(value);
      } else {
        setSelectedHost2(value);
      }
    } else if (type === 'command') {
      setSelectedCommand(value);
    } else if (type === 'vlan') {
      setVlanData((prev) => ({ ...prev, [key]: value }));
    } else if (type === 'switchport') {
      if (key === 'interface1') {
        setSelectedInterface1(value);  // Track the interface for SW1
      } else if (key === 'interface2') {
        setSelectedInterface2(value);  // Track the interface for SW2
      } else {
        setSwitchportMode(value);
      }
    }
  };
  

  const getInterfacesForHost = (hostname) => {
    const host = interfaceData.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  const handleSubmit = () => {
    if (!selectedHost1 || !selectedHost2 || !selectedCommand) {
      setError('Please select all hosts and commands.');
      return;
    }

    // For vlan, check if at least one host has vlan info
    if (selectedCommand === 'vlan' && (!vlanData.vlanId || !vlanData.vlanName)) {
      setError('Please provide VLAN ID and Name for at least one host.');
      return;
    }

    const requestData = {
      hostname1: selectedHost1,
      hostname2: selectedHost2,
      command: selectedCommand,
      vlanData,
      switchportMode,
      interface1: selectedInterface1,  // Include the selected interface for SW1
      interface2: selectedInterface2,  // Include the selected interface for SW2
    };

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
          console.log('Playbook created:', data.playbook);
        }
      })
      .catch((err) => setError(err.message));
  };


  return (
    <div className="App">
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
      <div className='content'>
        <h2>Select Host, Command, and Configuration</h2>
        <div className="host-selection-container">
          <div className="host-selection__dropdown-group">
            <label htmlFor="host1">Select Host (SW1):</label>
            <select
              id="host1"
              className="host-selection__dropdown"
              onChange={(e) => handleSelectChange('host1', 'host', e.target.value)}
              value={selectedHost1}
            >
              <option value="">-- Select a Host --</option>
              <option value="trunk">Test</option>
              {hosts.map((host) => (
                <option key={host.hostname} value={host.hostname}>
                  {host.hostname}
                </option>
              ))}
            </select>
          </div>

          <div className="host-selection__dropdown-group">
            <label htmlFor="host2">Select Host (SW2):</label>
            <select
              id="host2"
              className="host-selection__dropdown"
              onChange={(e) => handleSelectChange('host2', 'host', e.target.value)}
              value={selectedHost2}
            >
              <option value="">-- Select a Host --</option>
              <option value="trunk">Test</option>
              {hosts.map((host) => (
                <option key={host.hostname} value={host.hostname}>
                  {host.hostname}
                </option>
              ))}
            </select>
          </div>

          <div className="host-selection__dropdown-group">
            <label htmlFor="command">Select Command:</label>
            <select
              id="command"
              className="host-selection__dropdown"
              value={selectedCommand}
              onChange={(e) => handleSelectChange('command', 'command', e.target.value)}
            >
              <option value="">-- Select a Command --</option>
              <option value="trunk">Test</option>
              {commands.map((command) => (
                <option key={command.value} value={command.value}>
                  {command.label}
                </option>
              ))}
            </select>
          </div>

          {selectedHost1 && selectedHost2 && selectedCommand === 'switchport' && (
            <div className="host-selection__switchport-configuration">
              <div className="host-selection__dropdown-group">
                <label htmlFor="interface1">Select Interface for SW1:</label>
                <select
                  id="interface1"
                  className="host-selection__dropdown"
                  onChange={(e) => handleSelectChange('interface1', 'switchport', e.target.value)}
                >
                  <option value="">-- Select Interface --</option>
                  <option value="trunk">Test</option>
                  {getInterfacesForHost(selectedHost1).map((intf) => (
                    <option key={intf.interface} value={intf.interface}>
                      {intf.interface} ({intf.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="host-selection__dropdown-group">
                <label htmlFor="interface2">Select Interface for SW2:</label>
                <select
                  id="interface2"
                  className="host-selection__dropdown"
                  onChange={(e) => handleSelectChange('interface2', 'switchport', e.target.value)}
                >
                  <option value="">-- Select Interface --</option>
                  <option value="trunk">Test</option>
                  {getInterfacesForHost(selectedHost2).map((intf) => (
                    <option key={intf.interface} value={intf.interface}>
                      {intf.interface} ({intf.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="host-selection__dropdown-group">
                <label htmlFor="switchport-mode">Switchport Mode:</label>
                <select
                  id="switchport-mode"
                  className="host-selection__dropdown"
                  value={switchportMode}
                  onChange={(e) => handleSelectChange('switchport', 'switchport', e.target.value)}
                >
                  <option value="">-- Select Mode --</option>
                  <option value="trunk">Trunk</option>
                  <option value="access">Access</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSubmit}>Submit</button>
        {error && <div className="error">Error: {error}</div>}
      
      </div>
    </div>
  );
}

export default SwitchSwitch;