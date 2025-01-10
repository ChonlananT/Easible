import React, { useState, useEffect } from 'react';
import './Bar.css';

function Jobs() {
  const [hosts, setHosts] = useState([]);

  useEffect(() => {
    fetch('/api/get_hosts')
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched Hosts:', data); // Log the fetched data
        setHosts(data); // Store the data in state
      })
      .catch((err) => console.error('Error fetching hosts:', err));
  }, []);

  return (
    <div className="App">
      <ul className="nav-links">
      <img src="/easible-name.png" alt='' className="dashboard-icon" />
          <li className="center"><a href="/dashboard">Dashboard</a></li>
          <li className="center"><a href="/hosts">Hosts</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/topology">Topology</a></li>
      </ul>
      <div>Configuration</div>
    </div>
  );
}

export default Jobs;
