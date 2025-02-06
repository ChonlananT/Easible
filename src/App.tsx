import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.tsx';
import Hosts from './components/Hosts.tsx';
import './App.css';
import Jobs from './components/Jobs.tsx';
import RouterRouter from './components/RouterRouter.tsx';
import RouterSwitch from './components/RouterSwitch.tsx';
import SwitchSwitch from './components/SwitchSwitch.tsx';
import ConfigDevice from './components/ConfigDevice.tsx';
import Lab from './components/Topology.tsx';
import SwitchHost from './components/SwitchHost.tsx';

function App() {
  const [user, setUser] = useState('');
  const [awxData, setAwxData] = useState([]);
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    if (route === '/') {
      navigate('/dashboard');
    }
  }, [route]);

  useEffect(() => {
    fetch('/data')
      .then(response => response.json())
      .then(data => {
        setUser(data.user);

        // Sort the awx_data array by id in ascending order
        const sortedData = (data.awx_data || []).sort((a, b) => a.id - b.id);

        setAwxData(sortedData);
        console.log(sortedData);
      })
      .catch(error => console.error(error));
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = (path) => {
    window.history.pushState(null, '', path);
    setRoute(path);
  };

  if (route === '/dashboard') {
    return <Dashboard />;
  } else if (route === '/jobs') {
    return <Jobs />;
  } else if (route === '/hosts') {
    return <Hosts />;
  } else if (route === '/routerrouter') {
    return <RouterRouter />;
  } else if (route === '/routerswitch') {
    return <RouterSwitch />;
  } else if (route === '/switchswitch') {
    return <SwitchSwitch />;
  }else if (route === '/switchhost') {
    return <SwitchHost />;
  } else if (route === '/configdevice') {
    return <ConfigDevice />;
  }else {
    return <Lab />;
  }

  // return (
  //   <div className="App">
  //     <ul className="nav-links">
  //       <li className="center"><a href="#" onClick={() => navigate('/dashboard')}>Dashboard</a></li>
  //       <li className="center"><a href="#" onClick={() => navigate('/jobs')}>Jobs</a></li>
  //       <li className="center"><a href="#" onClick={() => navigate('/inventories')}>Inventories</a></li>
  //       <li className="center"><a href="#" onClick={() => navigate('/topology')}>Topology</a></li>
  //     </ul>
  //     <p>User: {user}</p>
  //     <p>AWX Data:</p>
  //     <div>
  //       {awxData.map(host => (
  //         <div key={host.id}>
  //           <div>ID: {host.id} | Name: {host.name} | Description: {host.description}</div>
  //         </div>
  //       ))}
  //     </div>
  //   </div>
  // );
}

export default App;
