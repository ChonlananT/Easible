import React from 'react';
import './Bar.css';

function RouterSwitch() {
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
      <div className='content'>
        <div className='content-topic'>
         Configuration <span className='content-topic-small'>(Router-Switch)</span>
          </div>
        <div className="content-board"></div>
      </div>
      
    </div>
  );
}

export default RouterSwitch;
