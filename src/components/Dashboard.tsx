import React, { useState, useEffect } from "react";
import { ArrowLeftFromLine, Menu } from "lucide-react";
import "./Bar.css";
import "./Dashboard.css";

/**
 * DonutChart component
 * แสดง label ด้านบน แล้วแสดงวง donut กับข้อความ online/offline อยู่ในแถวเดียวกัน
 * หากส่ง prop imageSrc เข้ามา รูปจะถูกแสดงไว้ในส่วนของ donut-hole
 */
function DonutChart({ onlineCount, offlineCount, label, imageSrc }) {
  const total = onlineCount + offlineCount;
  const onlinePercent = total > 0 ? (onlineCount / total) * 100 : 0;

  // สไตล์ไดนามิกสำหรับ background ของ donut
  const dynamicDonutStyle = {
    background: `conic-gradient(
      green 0% ${onlinePercent}%,
      red ${onlinePercent}% 100%
    )`,
  };

  return (
    <div className="donut-chart-container">
      <strong className="donut-label">{label}</strong>
      <div className="donut-row">
        <div className="donut" style={dynamicDonutStyle}>
          <div className="donut-hole">
            <img
              src={imageSrc}
              alt="device icon"
              className="donut-image"
            />
          </div>
        </div>
        <div className="donut-text">
          <div className="online-text">{onlineCount} Online</div>
          <div className="offline-text">{offlineCount} Offline</div>
        </div>
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
  const [dashboardData, setDashboardData] = useState(null);

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

  let onlineDevices = [];
  let offlineDevices = [];
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
          <li className="center">
            <a href="/jobs">Configuration</a>
          </li>
          <li className="center sub-topic">
            <a href="/routerrouter">router-router</a>
          </li>
          <li className="center sub-topic">
            <a href="/routerswitch">router-switch</a>
          </li>
          <li className="center sub-topic">
            <a href="/switchswitch">switch-switch</a>
          </li>
          <li className="center sub-topic"><a href="/routerswitch">switch-host</a></li>
          <li className="center sub-topic">
            <a href="/configdevice">config device</a>
          </li>
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
            <div className="donut-chart-wrapper">
              <DonutChart
                label="Devices"
                onlineCount={devicesOnline}
                offlineCount={devicesOffline}
                imageSrc="/device_icon.png"
              />
            </div>
            <div className="donut-chart-wrapper">
              <DonutChart
                label="Routers"
                onlineCount={routersOnline}
                offlineCount={routersOffline}
                imageSrc="/router_icon.png"
              />
            </div>
            <div className="donut-chart-wrapper">
              <DonutChart
                label="Switches"
                onlineCount={switchesOnline}
                offlineCount={switchesOffline}
                imageSrc="/switch_icon.png"
              />
            </div>
          </div>

          {loading && <div>Loading...</div>}
          {error && <div className="error-text">Error: {error}</div>}
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
