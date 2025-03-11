// Navbar.jsx
import React, { useState, useEffect } from "react";
import { ArrowLeftFromLine, ChevronDown } from "lucide-react";
import { useLocation } from "react-router-dom"; // Import useLocation hook
import "./Bar.css";

// List of routes that belong to the configuration subtopics.
const configPaths = [
  "/routerrouter",
  "/routerswitch",
  "/switchswitch",
  "/switchhost",
];



const Navbar = ({ isNavOpen, setIsNavOpen }) => {
  const location = useLocation(); // Get current route
  const isConfigActive = configPaths.includes(location.pathname);
  // Initialize dropdown state from localStorage.
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(() => {
    const storedValue = localStorage.getItem("isNavDropdownOpen");
    // If there's a stored value, use it; otherwise, if current route is a config route, open it.
    if (storedValue !== null) {
      return storedValue === "true";
    }
    return configPaths.includes(location.pathname);
  });

  // When location changes, if it's one of the config pages, force the dropdown open.
  useEffect(() => {
    if (configPaths.includes(location.pathname)) {
      setIsNavDropdownOpen(true);
    }
  }, [location.pathname]);

  // Save the dropdown state to localStorage so it persists across navigation.
  useEffect(() => {
    localStorage.setItem("isNavDropdownOpen", isNavDropdownOpen.toString());
  }, [isNavDropdownOpen]);

  const toggleNavDropdown = () => {
    setIsNavDropdownOpen((prev) => !prev);
  };

  // Define an active style for links
  const activeStyle = { color: "#8c94dc" };

  return (
    <div className={`nav-links-container ${isNavOpen ? "" : "closed"}`}>
      <div className="nav-top">
        <button
          style={{
            marginBottom: "16px",
            padding: "8px",
            color: "#7b7b7b",
            borderRadius: "50%",
            border: "none",
            background: "#e2e6ea",
            cursor: "pointer",
            transition: "background 0.3s ease",
          }}
          onClick={() => setIsNavOpen(false)}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#d0d5da")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#e2e6ea")}
        >
          <ArrowLeftFromLine size={24} />
        </button>
        <a href="/dashboard">
          <img src="/easible-name.png" alt="Logo" className="dashboard-icon" />
        </a>
      </div>
      <ul className="nav-links">
        <li className="center">
          <a
            href="/dashboard"
            style={location.pathname === "/dashboard" ? activeStyle : {}}
          >
            Dashboard
          </a>
        </li>
        <li className="center">
          <a
            href="/hosts"
            style={location.pathname === "/hosts" ? activeStyle : {}}
          >
            Devices
          </a>
        </li>
        <li
          className="center"
          onClick={toggleNavDropdown}
          style={{
            cursor: "pointer",
            color: isConfigActive ? "#8c94dc" : "black",
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#8c94dc")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = isConfigActive ? "#8c94dc" : "black")
          }
        >
          <a>Configure connections </a>
          <ChevronDown
            className={isNavDropdownOpen ? "chevron-nav rotated" : "chevron-nav"}
          />
        </li>
        <ul className={`nav-dropdown ${isNavDropdownOpen ? "open" : ""}`}>
          <li className="center sub-topic">
            <a
              href="/routerrouter"
              style={location.pathname === "/routerrouter" ? activeStyle : {}}
            >
              router-router
            </a>
          </li>
          <li className="center sub-topic">
            <a
              href="/routerswitch"
              style={location.pathname === "/routerswitch" ? activeStyle : {}}
            >
              router-switch
            </a>
          </li>
          <li className="center sub-topic">
            <a
              href="/switchswitch"
              style={location.pathname === "/switchswitch" ? activeStyle : {}}
            >
              switch-switch
            </a>
          </li>
          <li className="center sub-topic">
            <a
              href="/switchhost"
              style={location.pathname === "/switchhost" ? activeStyle : {}}
            >
              switch-host
            </a>
          </li>
        </ul>
        <li className="center">
          <a
            href="/configdevice"
            style={location.pathname === "/configdevice" ? activeStyle : {}}
          >
            Configure devices
          </a>
        </li>
        <li className="center">
          <a
            href="/lab"
            style={location.pathname === "/lab" ? activeStyle : {}}
          >
            Lab Check
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Navbar;
