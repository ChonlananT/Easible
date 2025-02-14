import React, { useState, useEffect } from "react";
import { ArrowLeftFromLine, ChevronDown, Menu } from "lucide-react";
import "./Bar.css";
import "./Dashboard.css";

/**
 * DonutChart component
 * แสดง label ด้านบน แล้วแสดงวง donut กับข้อความ online/offline อยู่ในแถวเดียวกัน
 * หากส่ง prop imageSrc เข้ามา รูปจะถูกแสดงไว้ในส่วนของ donut-hole
 */
function DonutChart({ onlineCount, offlineCount, label, imageSrc, size = 120, isDeviceChart = false }) {
  const total = onlineCount + offlineCount;
  const onlinePercent = total > 0 ? (onlineCount / total) * 100 : 0;

  const dynamicDonutStyle = {
    width: `${size}px`,
    height: `${size}px`,
    background: `conic-gradient(
      green 0% ${onlinePercent}%,
      red ${onlinePercent}% 100%
    )`,
  };

  const donutHoleSize = size * 0.95; // Adjust hole size relative to donut size

  return (
    <div className="donut-chart-container">
      <strong className="donut-label">{label}</strong>
      <div className="donut-row">
        <div className="donut" style={dynamicDonutStyle}>
          {/* Adjusted donut hole size based on isDeviceChart */}
          <div
            className="donut-hole"
            style={{
              width: `${isDeviceChart ? donutHoleSize : donutHoleSize * 0.95}px`,
              height: `${isDeviceChart ? donutHoleSize : donutHoleSize * 0.95}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {/* Render different content based on isDeviceChart */}
            {isDeviceChart ? (
              <div className="donut-text">
                <div className="online-text">{onlineCount} Online</div>
                <div className="offline-text">{offlineCount} Offline</div>
              </div>
            ) : (
              <img
                src={imageSrc}
                alt="device icon"
                className="donut-image"
                style={{ width: `${donutHoleSize * 0.4}px`, height: `${donutHoleSize * 0.4}px` }}
              />
            )}
          </div>
        </div>
  
        {/* Only show text on the right for Routers & Switches */}
        {!isDeviceChart && (
          <div className="donut-text">
            <div className="online-text">{onlineCount} Online</div>
            <div className="offline-text">{offlineCount} Offline</div>
          </div>
        )}
      </div>
    </div>
  );
  
}




function Dashboard() {
  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem("isNavOpen");
    return savedNavState === "true";
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  interface DashboardData {
    ok: { hostname: string; deviceType: string }[];
    fatal: { hostname: string; deviceType: string }[];
  }

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    localStorage.setItem("isNavOpen", isNavOpen.toString());
  }, [isNavOpen]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDashboardData(data.parsed_result);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  let onlineDevices: { hostname: string; deviceType: string; status: string }[] = [];
  let offlineDevices: { hostname: string; deviceType: string; status: string }[] = [];
  if (dashboardData) {
    onlineDevices = dashboardData.ok.map((device) => ({
      ...device,
      status: "online",
    }));
    offlineDevices = dashboardData.fatal.map((device) => ({
      ...device,
      status: "offline",
    }));
  }

  const allDevices = [...onlineDevices, ...offlineDevices];

  const routers = allDevices
    .filter((device) => device.deviceType.toLowerCase() === "router")
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
  const switches = allDevices
    .filter((device) => device.deviceType.toLowerCase() === "switch")
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const devicesOnline = allDevices.filter((d) => d.status === "online").length;
  const devicesOffline = allDevices.filter((d) => d.status === "offline").length;

  const routersOnline = routers.filter((r) => r.status === "online").length;
  const routersOffline = routers.filter((r) => r.status === "offline").length;

  const switchesOnline = switches.filter((s) => s.status === "online").length;
  const switchesOffline = switches.filter((s) => s.status === "offline").length;

  const renderStatusLabel = (status) => {
    return (
      <span className={status === "online" ? "status-online" : "status-offline"}>
        {status}
      </span>
    );
  };


  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () =>{
    setIsNavDropdownOpen(!isNavDropdownOpen);
  }

  return (
    <div className="App">
      <div className={`nav-links-container ${isNavOpen ? "" : "closed"}`}>
        <div className="nav-top">
          <button className="nav-close-btn" onClick={() => setIsNavOpen(false)}>
            <ArrowLeftFromLine size={24} />
          </button>
          <img src="/easible-name.png" alt="" className="dashboard-icon" />
        </div>
        <ul className="nav-links">
          <li className="center">
            <a href="/dashboard" style={{ color: "#8c94dc" }}>
              Dashboard
            </a>
          </li>
          <li className="center">
            <a href="/hosts">Devices</a>
          </li>
                    <li 
            className="center" 
            onClick={toggleNavDropdown} 
            style={{ cursor: 'pointer', color: 'black' }} 
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = '#8c94dc'} 
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'black'}
          >
            <a>Configuration  </a>
            <ChevronDown className={isNavDropdownOpen ? "chevron-nav rotated" : "chevron-nav"}/>
          </li>
          <ul className={`nav-dropdown ${isNavDropdownOpen ? "open" : ""}`}>
            <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
            <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
            <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
            <li className="center sub-topic"><a href="/switchhost">switch-host</a></li>
            <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          </ul>
          <li className="center">
            <a href="/lab">Lab Check</a>
          </li>
        </ul>
      </div>
      <div className={`content ${isNavOpen ? "expanded" : "full-width"}`}>
        <div className="content-topic">
          {!isNavOpen && (
            <button className="nav-open-btn" onClick={() => setIsNavOpen(true)}>
              <Menu size={24} />
            </button>
          )}
          Dashboard
        </div>
        <div className="content-body">
          {/* Header row สำหรับ Donut Chart */}
          <div className="donut-chart-row">
            {/* Devices Donut (Bigger, Text Inside Hole) */}
            <div style={{ padding: '0px', width: '60%' }}>
              <div className="donut-chart-wrapper">
                <DonutChart
                  imageSrc=""
                  label="Devices"
                  onlineCount={devicesOnline}
                  offlineCount={devicesOffline}
                  size={300}  // Bigger for emphasis
                  isDeviceChart={true}  // 🔥 Enables text inside the hole
                />
              </div>
            </div>

            {/* Routers and Switches Donuts (Smaller, Normal Design) */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '40%', gap: '10px' }}>
              <div className="donut-chart-wrapper">
                <DonutChart
                  label="Routers"
                  onlineCount={routersOnline}
                  offlineCount={routersOffline}
                  imageSrc="/router_icon.png"
                  size={120} 
                />
              </div>
              <div className="donut-chart-wrapper">
                <DonutChart
                  label="Switches"
                  onlineCount={switchesOnline}
                  offlineCount={switchesOffline}
                  imageSrc="/switch_icon.png"
                  size={120}
                />
              </div>
            </div>
          </div>



          {loading && <div style={{ fontSize:"20px", marginTop:"20px", textAlign:"center"}}>Loading...</div>}
          {error && <div className="error-text" style={{ textAlign: 'center', marginTop: '20px' }}>Error: {error}</div>}
          {!loading && !error && (
            <div className="device-details-row">
              {/* Detailed Routers List */}
              <div className="device-detail">
                <h2>Router</h2>
                {routers.length > 0 ? (
                  routers.map((device) => (
                    <div key={device.hostname}>
                      {device.hostname} {renderStatusLabel(device.status)}
                    </div>
                  ))
                ) : (
                  <div>No router devices found.</div>
                )}
              </div>

              {/* Detailed Switches List */}
              <div className="device-detail">
                <h2>Switch</h2>
                {switches.length > 0 ? (
                  switches.map((device) => (
                    <div key={device.hostname}>
                      {device.hostname} {renderStatusLabel(device.status)}
                    </div>
                  ))
                ) : (
                  <div>No switch devices found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
