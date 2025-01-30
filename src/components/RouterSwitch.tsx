import React, { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import './Bar.css';

function RouterSwitch() {
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: '10px', paddingTop: '10px'  }}>
          <button
            style={{
              marginBottom: '16px',
              padding: '8px',
              color: 'black',
              borderRadius: '8px',
              zIndex: 50,
              border: 'none',
            }}
            onClick={() => setIsNavOpen(false)}
          >
            <Menu size={24} />
          </button>
          <img src="/easible-name.png" alt="" className="dashboard-icon" />
        </div>
        <ul className="nav-links">
          <li className="center">
            <a href="/dashboard">Dashboard</a>
          </li>
          <li className="center"><a href="/hosts">Hosts</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch" style={{ color: '#8c94dc' }}>router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/topology">Lab Check</a></li>
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
              <Menu size={24} />
            </button>
          )}
         Configuration <span className='content-topic-small'>(Router-Switch)</span>
          </div>
        <div className="content-board"></div>
      </div>
      
    </div>
  );
}

export default RouterSwitch;

