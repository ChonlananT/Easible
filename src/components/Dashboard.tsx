import React from 'react';
import './Bar.css';
import './Dashboard.css';

function Dashboard() {
  return (
    <div className="App">
      <ul className="nav-links">
          <img src="/easible-name.png" alt='' className="dashboard-icon" />
          <li className="center"><a href="/dashboard" style={{ color: '#8c94dc' }}>Dashboard</a></li>
          <li className="center"><a href="/hosts">Hosts</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/topology">Topology</a></li>
      </ul>
    </div>
  );
}

export default Dashboard;
