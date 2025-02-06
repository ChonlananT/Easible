import React, { useState, useEffect } from 'react';
import './Bar.css';
import { ArrowLeftFromLine } from 'lucide-react';
import { Menu } from 'lucide-react';
import './Jobs.css';

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

  const [isNavOpen, setIsNavOpen] = useState(() => {
        const savedNavState = localStorage.getItem('isNavOpen');
        return savedNavState === 'true';  // Convert to boolean
      });
  
    useEffect(() => {
        localStorage.setItem('isNavOpen', isNavOpen.toString());
      }, [isNavOpen]);

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
          <li className="center">
            <a href="/dashboard">Dashboard</a>
          </li>
          <li className="center"><a href="/hosts">Devices</a></li>
          <li className="center"><a href="/jobs" style={{ color: '#8c94dc' }}>Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/routerswitch">switch-host</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/lab">Lab Check</a></li>
        </ul>
      </div>
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
              <Menu />
            </button>
          )}
         Configuration
        </div>
        <div className="card-container">
          <div className="conf-card" onClick={() => window.location.href = "/routerrouter"}>
            <span>Router-Router</span>
          </div>
          <div className="conf-card" onClick={() => window.location.href = "/routerswitch"}>
            <span>Router-Switch</span>
          </div>
          <div className="conf-card" onClick={() => window.location.href = "/switchswitch"}>
            <span>Switch-Switch</span>
          </div>
          <div className="conf-card" onClick={() => window.location.href = "/configdevice"}>
            <span>Config Device</span>
          </div>
        </div>

      </div>
      
    </div>
  );
}

export default Jobs;
