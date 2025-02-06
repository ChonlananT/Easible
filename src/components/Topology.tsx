import React, { useState, useEffect } from "react";
import { ArrowLeftFromLine, ChevronDown, ChevronRight, ChevronRightCircle, Menu, X } from "lucide-react";
import './Bar.css';
import './Topology.css';

function Lab() {
const [isNavOpen, setIsNavOpen] = useState(() => {
  const savedNavState = localStorage.getItem('isNavOpen');
    return savedNavState === 'true';  // Convert to boolean
  });

  useEffect(() => {
      localStorage.setItem('isNavOpen', isNavOpen.toString());
    }, [isNavOpen]);

  
  const labs = [
    { id: 1, title: "Lab 1 (Static Route)", content: "Details about Static Route" },
    { id: 2, title: "Lab 2 (RIPv2)", content: "Details about RIPv2" },
    { id: 3, title: "Lab 3 (OSPF)", content: "Details about OSPF" },
    { id: 4, title: "Lab 4 (Spanning Tree Protocol)", content: "Details about STP" },
    { id: 5, title: "Lab 5 (PTSD)", content: "Details about STP" }
  ];
  const [expanded, setExpanded] = useState<number | null>(null);
  const toggleExpanded = (id) => {
    setExpanded(expanded === id ? null : id);
  }

  
  
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
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/routerswitch">switch-host</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/lab" style={{ color: '#8c94dc' }}>Lab Check</a></li>
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
         Lab check
          </div>
        <div className="content-board-lab">
          <div className="lab-topic">Choose lab</div>
          <div className="lab-board-container">
            <div className="lab-board">
              {labs.map((lab) => (
                <div key={lab.id}>
                  <div className="lab-item">
                    <div style={{width: '100%', cursor: 'pointer', fontSize: '20px', fontWeight: '450'}} onClick={() => toggleExpanded(lab.id)}>
                      {lab.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '50px'}}>
                      <div className="host-name-lab">
                        Host 1:
                        <div className="dropdown-lab">
                          <select className="dropdown-select-lab">
                            <option value="option1">Option 1</option>
                            <option value="option2">Option 2</option>
                            <option value="option3">Option 3</option>
                          </select>
                        </div>
                      </div>
                      <div className="host-name-lab">
                        Host 2:
                        <div className="dropdown-lab">
                          <select className="dropdown-select-lab">
                            <option value="option1">Option 1</option>
                            <option value="option2">Option 2</option>
                            <option value="option3">Option 3</option>
                          </select>
                        </div>
                      </div>
                      <div style={{width: '100%', height: '100%', cursor: 'pointer'}} onClick={() => toggleExpanded(lab.id)}>
                        {expanded === lab.id 
                        ? (<ChevronDown size={24} />) 
                        : (<ChevronRight size={24} />)
                        }
                      </div>
                    </div>
                  </div>
                  {expanded === lab.id && (
                  <div className="lab-content">
                    <div className="expect-container">
                    <div className="expect-section">
                      Expect host 1
                      <div className="input-lab">
                        <textarea className="expect-input" placeholder="Enter text..."></textarea>
                      </div>
                    </div>

                      <div className="expect-section">
                        Expect host 2
                        <div className="input-lab">
                          <textarea className="expect-input" placeholder="Enter text..."></textarea>
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex', justifyContent:'flex-end', margin:'5px'}}>
                      <button className="green-round-lab">Check</button>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lab;
