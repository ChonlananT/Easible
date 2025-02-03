import React, { useState, useEffect } from "react";
import { ArrowLeftFromLine, Menu, X } from "lucide-react";
import './Bar.css';

function Topology() {
  return (
    <div className="App">
      <ul className="nav-links">
      <img src="/easible-name.png" alt='' className="dashboard-icon" />
          <li className="center"><a href="/dashboard">Dashboard</a></li>
          <li className="center"><a href="/hosts">Devices</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/topology" style={{ color: '#8c94dc' }}>Lab Check</a></li>
      </ul>
      <div>Topology</div>
    </div>
  );
}

export default Topology;
