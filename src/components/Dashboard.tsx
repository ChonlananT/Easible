import React, { useState, useEffect } from "react";
import { Menu, RefreshCcw } from "lucide-react";
import "./Bar.css";
import "./Dashboard.css";
import "./Lab.css";
import Navbar from "./Navbar.tsx";

/**
 * DonutChart component
 * แสดง label ด้านบน แล้วแสดงวง donut กับข้อความ online/offline อยู่ในแถวเดียวกัน
 * หากส่ง prop imageSrc เข้ามา รูปจะถูกแสดงไว้ในส่วนของ donut-hole
 */
function DonutChart({
  onlineCount,
  offlineCount,
  label,
  imageSrc,
  size = 120,
  isDeviceChart = false,
}) {
  const total = onlineCount + offlineCount;
  const onlinePercent = total > 0 ? (onlineCount / total) * 100 : 0;

  const dynamicDonutStyle = {
    width: `${size}px`,
    height: `${size}px`,
    background: onlinePercent === 0
      ? "grey"
      : `conic-gradient(
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
              width: `${isDeviceChart ? donutHoleSize : donutHoleSize * 0.95
                }px`,
              height: `${isDeviceChart ? donutHoleSize : donutHoleSize * 0.95
                }px`,
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
                style={{
                  width: `${donutHoleSize * 0.4}px`,
                  height: `${donutHoleSize * 0.4}px`,
                }}
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

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );

  useEffect(() => {
    localStorage.setItem("isNavOpen", isNavOpen.toString());
  }, [isNavOpen]);

  const fetchDashboard = () => {
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
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  let onlineDevices: {
    hostname: string;
    deviceType: string;
    status: string;
  }[] = [];
  let offlineDevices: {
    hostname: string;
    deviceType: string;
    status: string;
  }[] = [];
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
    .filter((device) => device.deviceType && device.deviceType.toLowerCase() === "router")
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
  const switches = allDevices
    .filter((device) => device.deviceType && device.deviceType.toLowerCase() === "switch")
    .sort((a, b) => a.hostname.localeCompare(b.hostname));

  const devicesOnline = allDevices.filter((d) => d.status === "online").length;
  const devicesOffline = allDevices.filter(
    (d) => d.status === "offline"
  ).length;

  const routersOnline = routers.filter((r) => r.status === "online").length;
  const routersOffline = routers.filter((r) => r.status === "offline").length;

  const switchesOnline = switches.filter((s) => s.status === "online").length;
  const switchesOffline = switches.filter((s) => s.status === "offline").length;

  const renderStatusLabel = (status) => {
    return (
      <span
        className={status === "online" ? "status-online" : "status-offline"}
      >
        {status}
      </span>
    );
  };

  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () => {
    setIsNavDropdownOpen(!isNavDropdownOpen);
  };

  return (
    <div className="App">
      <Navbar isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} />
      <div className={`content ${isNavOpen ? "expanded" : "full-width"}`}>
        <div
          className="content-topic"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <div>
            {!isNavOpen && (
              <button
                className="nav-open-btn"
                onClick={() => setIsNavOpen(true)}
              >
                <Menu size={24} />
              </button>
            )}
            Dashboard
          </div>
          {/* Refresh button that triggers data re-fetch */}
          <button
            onClick={fetchDashboard}
            style={{
              display: "flex",
              fontSize: "16px",
              gap: "10px",
              alignItems: "center",
              paddingRight: "50px",
              paddingTop: "20px",
              border: "none",
              background: "none",
              cursor: "pointer",

            }}
            disabled={loading}
            className="button-refresh"
          >
            <RefreshCcw /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner-lab" />
            <p>Loading...</p>
          </div>
        ) : (
          <div className="content-body" style={{ position: "relative" }}>
            {/* The main content */}
            <div className="donut-chart-row">
              {/* Devices Donut (Bigger, Text Inside Hole) */}
              <div style={{ padding: "0px", width: "60%" }}>
                <div className="donut-chart-wrapper">
                  <DonutChart
                    imageSrc=""
                    label="Devices"
                    onlineCount={devicesOnline}
                    offlineCount={devicesOffline}
                    size={300} // Bigger for emphasis
                    isDeviceChart={true} // 🔥 Enables text inside the hole
                  />
                </div>
              </div>

              {/* Routers and Switches Donuts (Smaller, Normal Design) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "40%",
                  gap: "10px",
                }}
              >
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

            {error && (
              <div
                className="error-text"
                style={{ textAlign: "center", marginTop: "20px" }}
              >
                Error: {error}
              </div>
            )}

            {!error && (
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
        )}
      </div>
    </div>
  );

}

export default Dashboard;
