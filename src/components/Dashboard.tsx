import React from 'react';
import './Bar.css';

function Dashboard() {
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
      <div>Dashboard</div>
    </div>
  );
}

export default Dashboard;
