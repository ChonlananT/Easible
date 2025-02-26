import React, { useState, useEffect } from "react";
import "./Bar.css";
import "./RouterRouter.css";
import "./SwitchSwitch.css";
import "./Lab.css";
import NetworkTopology from "./NetworkTopology(Router).tsx";
import Navbar from "./Navbar.tsx";
import Spinner from "./bootstrapSpinner.tsx";
import { ArrowLeftFromLine, ChevronDown, Menu } from "lucide-react";

type DropdownOption = {
  hostname: string;
  interfaces: {
    details: {
      ip_address: string;
      status: string;
    };
    interface: string;
  }[];
};

type InterfaceData = {
  hostname: string;
  interfaces: {
    interface: string;
    ip_address: string;
    status: string;
  }[];
};

type StaticRoute = {
  prefix: string;
  subnet: number;
  nextHop: string;
};

type LinkConfig = {
  hostname1: string;
  hostname2: string;
  interface1: string;
  interface2: string;
  ip1: string;
  ip2: string;
  subnet: string;
  protocol: string; // none, rip, ospf, static
  staticRoute1?: StaticRoute;
  staticRoute2?: StaticRoute;
};

function RouterRouter() {
  const [hosts, setHosts] = useState<DropdownOption[]>([]);
  const [interfaceData, setInterfaceData] = useState<InterfaceData[]>([]);
  const [links, setLinks] = useState<LinkConfig[]>([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState<boolean>(true);

  // New states for popup and dynamic routing tables
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState<LinkConfig[]>([]);
  const [routingTables, setRoutingTables] = useState<any>({});
  const [showComparisonPopup, setShowComparisonPopup] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [parsedRoutes, setParsedRoutes] = useState<any>(null);
  const [isClosing, setIsClosing] = useState(false);

  // New state for loading in comparison popup
  const [isLoading, setIsLoading] = useState(false);

  // protocol ที่มีให้เลือก
  const protocols = [
    { label: "None (Only IP Address)", value: "none" },
    { label: "RIPv2", value: "ripv2" },
    { label: "OSPF", value: "ospf" },
  ];

  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem("isNavOpen");
    return savedNavState === "true";
  });

  useEffect(() => {
    localStorage.setItem("isNavOpen", isNavOpen.toString());
  }, [isNavOpen]);

  // useEffect: ดึงข้อมูล Hosts/Interfaces จาก backend
  useEffect(() => {
    setLoading(true);
    fetch("/api/show_detail_router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const halfLength = Math.floor(data.parsed_result.length / 2);
        const secondHalf = data.parsed_result.slice(halfLength);

        setHosts(data.parsed_result);

        const iData = data.parsed_result.map((item: any) => ({
          hostname: item.hostname,
          interfaces: item.interfaces.map((interfaceItem: any) => ({
            interface: interfaceItem.interface,
            ip_address: interfaceItem.detail.ip_address,
            status: interfaceItem.detail.status,
          })),
        }));
        setInterfaceData(iData);

        // เริ่มด้วยลิงก์เปล่า 1 link
        setLinks([
          {
            hostname1: "",
            hostname2: "",
            interface1: "",
            interface2: "",
            ip1: "",
            ip2: "",
            subnet: "30", // default เป็น /24
            protocol: "none",
          },
        ]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ฟังก์ชันดึง interfaces ของ host
  const getInterfacesForHost = (hostname: string) => {
    const host = interfaceData.find((h) => h.hostname === hostname);
    return host ? host.interfaces : [];
  };

  // ฟังก์ชัน handle Add Link
  const handleAddLink = () => {
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        hostname1: "",
        hostname2: "",
        interface1: "",
        interface2: "",
        ip1: "",
        ip2: "",
        subnet: "30",
        protocol: "none",
      },
    ]);
  };

  // ฟังก์ชัน handle Remove Link
  const handleRemoveLink = (index: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== index));
  };

  // ฟังก์ชันเปลี่ยนค่าใน link
  const handleChange = (
    index: number,
    field:
      | keyof LinkConfig
      | { group: "staticRoute1" | "staticRoute2"; key: keyof StaticRoute },
    value: string
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const link = { ...newLinks[index] };

      if (typeof field === "string") {
        (link as any)[field] = value;

        if (field === "protocol" && value === "static") {
          link.staticRoute1 = { prefix: "", subnet: 24, nextHop: "" };
          link.staticRoute2 = { prefix: "", subnet: 24, nextHop: "" };
        }

        if (field === "protocol" && value !== "static") {
          delete link.staticRoute1;
          delete link.staticRoute2;
        }
      } else {
        if (field.group === "staticRoute1") {
          link.staticRoute1 = {
            ...link.staticRoute1,
            [field.key]: value,
            prefix: link.staticRoute1?.prefix || "",
            subnet: link.staticRoute1?.subnet || 24,
            nextHop: link.staticRoute1?.nextHop || "",
          };
          link.staticRoute2 = {
            ...link.staticRoute2,
            [field.key]: value,
            prefix: link.staticRoute2?.prefix || "",
            subnet: link.staticRoute2?.subnet || 24,
            nextHop: link.staticRoute2?.nextHop || "",
          };
        }
      }

      newLinks[index] = link;
      return newLinks;
    });
  };

  const handleConfirm = () => {
    if (!routingTables || Object.keys(routingTables).length === 0) {
      setError("No routing tables found to verify.");
      return;
    }

    const payload = {
      routing_tables: routingTables,
    };

    // Set loading state for the comparison popup
    setShowPopup(false);
    setIsLoading(true);
    setShowComparisonPopup(true);

    fetch("/api/run_playbook/rttort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        handleClosePopup();
        setComparisonResult(data.comparison);
        setParsedRoutes(data.parsed_routes);

      })
      .catch((err) => {
        setError(err.message);
        console.error("Error verifying:", err);
      })
      .finally(() => {
        // End loading state once the fetch completes
        setIsLoading(false);
      });
  };

  // ฟังก์ชัน Submit ทั้งหมด
  const handleSubmitAll = () => {
    setError("");
    for (let link of links) {
      if (
        !link.hostname1 ||
        !link.hostname2 ||
        !link.interface1 ||
        !link.interface2 ||
        !link.ip1 ||
        !link.ip2 ||
        !link.subnet
      ) {
        setError("Please fill all required fields for each link.");
        return;
      }

      if (link.protocol === "static") {
        if (
          !link.staticRoute1 ||
          !link.staticRoute1.prefix ||
          !link.staticRoute1.subnet ||
          !link.staticRoute1.nextHop ||
          !link.staticRoute2 ||
          !link.staticRoute2.prefix ||
          !link.staticRoute2.subnet ||
          !link.staticRoute2.nextHop
        ) {
          setError("Please fill all Static Route fields for each link.");
          return;
        }
      }
    }
    const requestData = links.map((link) => ({
      hostname1: link.hostname1,
      hostname2: link.hostname2,
      interface1: link.interface1,
      interface2: link.interface2,
      ip1: link.ip1,
      ip2: link.ip2,
      subnet: link.subnet,
      protocol: link.protocol,
      ...(link.protocol === "static" && link.staticRoute1 && link.staticRoute2
        ? { staticRoute1: link.staticRoute1, staticRoute2: link.staticRoute2 }
        : {}),
    }));



    setPopupData(requestData);
    setShowPopup(true);

    fetch("/api/create_playbook_rttort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setRoutingTables(data.routing_tables);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error("Error:", err);
      });
  };

  const handleClosePopup = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowPopup(false);
      setIsClosing(false);
    }, 500);
  };

  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () => {
    setIsNavDropdownOpen(!isNavDropdownOpen);
  };

  return (
    <div className="App">
      <Navbar isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} />
      <div className={`content ${isNavOpen ? "expanded" : "full-width"}`}>
        <div className="content-topic">
          {!isNavOpen && (
            <button
              style={{
                padding: "8px",
                color: "black",
                borderRadius: "8px",
                zIndex: 50,
                border: "none",
                background: "white",
                marginRight: "8px",
              }}
              onClick={() => setIsNavOpen(true)}
            >
              <Menu size={24} />
            </button>
          )}
          Configuration
          <span className="content-topic-small"> (Router-Router)</span>
        </div>
        <div className="content-board">
          <div className="all-links">
            {links.map((link, index) => (
              <div key={index} className="switch-switch">
                <div className="top-link">
                  <div className="link-index">Link {index + 1}</div>
                  <div className="remove-link-container">
                    {links.length > 1 && (
                      <button
                        onClick={() => handleRemoveLink(index)}
                        className="button-sw-sw-remove"
                      >
                        <img
                          src="bin.png"
                          alt="Remove link"
                          style={{ width: "45px", height: "27px" }}
                        />
                      </button>
                    )}
                  </div>
                </div>

                <div className="content-section">
                  <div className="content-align-rt-rt">
                    <div className="host-section-rt-rt">
                      <div className="host-group-rt-rt">
                        <div className="host-card">
                          <div className="host-selection__dropdown-group">
                            <label>Router1 (Host):</label>
                            <div className="host-selection__dropdown-container">
                              <select
                                className="host-selection__dropdown"
                                value={link.hostname1}
                                onChange={(e) =>
                                  handleChange(index, "hostname1", e.target.value)
                                }
                              >
                                <option value="">
                                  -- Select Router (Host1) --
                                </option>
                                {!loading &&
                                  hosts
                                    .filter(
                                      (host) => host.hostname !== link.hostname2
                                    )
                                    .map((host) => (
                                      <option
                                        key={host.hostname}
                                        value={host.hostname}
                                      >
                                        {host.hostname}
                                      </option>
                                    ))}
                              </select>
                            </div>
                          </div>
                          <div className="host-selection__dropdown-group">
                            <label>Interface of Router1:</label>
                            <select
                              className="host-selection__dropdown"
                              value={link.interface1}
                              onChange={(e) =>
                                handleChange(index, "interface1", e.target.value)
                              }
                            >
                              <option value="">-- Select Interface --</option>
                              {getInterfacesForHost(link.hostname1).map((intf) => (
                                <option
                                  key={intf.interface}
                                  value={intf.interface}
                                >
                                  {intf.interface} ({intf.status})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="ip-subnet-group">
                            <div className="host-selection__dropdown-group" style={{ width: '80%' }}>
                              <label>IP Address (Router1):</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.ip1}
                                onChange={(e) =>
                                  handleChange(index, "ip1", e.target.value)
                                }
                                placeholder="Enter IP for Router1"
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ fontSize: '25px', marginTop: '25px' }}>/</span>
                            </div>
                            <div className="host-selection__dropdown-group" style={{ width: '40%' }}>
                              <label>Subnet (CIDR):</label>
                              <input
                                type="number"
                                min={1}
                                max={32}
                                className="host-selection__dropdown"
                                value={link.subnet}
                                onChange={(e) =>
                                  handleChange(index, "subnet", e.target.value)
                                }
                                placeholder="24"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="connect-pic-rt-rt">
                        <img
                          src="connect.png"
                          alt="Remove link"
                          style={{ width: "150px", height: "100px" }}
                        />
                        <label style={{ fontSize: "15px" }}>
                          Routing protocol activation:
                        </label>
                        <select
                          className="host-selection__dropdown"
                          value={link.protocol}
                          onChange={(e) =>
                            handleChange(index, "protocol", e.target.value)
                          }
                        >
                          {protocols.map((prot) => (
                            <option key={prot.value} value={prot.value}>
                              {prot.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="host-group-rt-rt">
                        <div className="host-card">
                          <div className="host-selection__dropdown-group">
                            <label>Router2 (Host):</label>
                            <select
                              className="host-selection__dropdown"
                              value={link.hostname2}
                              onChange={(e) =>
                                handleChange(index, "hostname2", e.target.value)
                              }
                            >
                              <option value="">
                                -- Select Router (Host2) --
                              </option>
                              {hosts
                                .filter(
                                  (host) => host.hostname !== link.hostname1
                                )
                                .map((host) => (
                                  <option
                                    key={host.hostname}
                                    value={host.hostname}
                                  >
                                    {host.hostname}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="host-selection__dropdown-group">
                            <label>Interface of Router2:</label>
                            <select
                              className="host-selection__dropdown"
                              value={link.interface2}
                              onChange={(e) =>
                                handleChange(index, "interface2", e.target.value)
                              }
                            >
                              <option value="">-- Select Interface --</option>
                              {getInterfacesForHost(link.hostname2).map((intf) => (
                                <option
                                  key={intf.interface}
                                  value={intf.interface}
                                >
                                  {intf.interface} ({intf.status})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="ip-subnet-group">
                            <div className="host-selection__dropdown-group" style={{ width: '80%' }}>
                              <label>IP Address (Router2):</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.ip2}
                                onChange={(e) =>
                                  handleChange(index, "ip2", e.target.value)
                                }
                                placeholder="Enter IP for Router2"
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ fontSize: '25px', marginTop: '25px' }}>/</span>
                            </div>
                            <div className="host-selection__dropdown-group" style={{ width: '40%' }}>
                              <label>Subnet (CIDR):</label>
                              <input
                                type="number"
                                min={1}
                                max={32}
                                className="host-selection__dropdown"
                                value={link.subnet}
                                onChange={(e) =>
                                  handleChange(index, "subnet", e.target.value)
                                }
                                placeholder="24"
                                disabled={true}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {link.protocol === "static" && (
                      <div className="protocal-section">
                        <div className="protocol-card">
                          <div className="static-route-section">
                            <h5>Static Route for Host 1</h5>
                            <div className="host-selection__dropdown-group">
                              <label>Prefix:</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.staticRoute1?.prefix || ""}
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    { group: "staticRoute1", key: "prefix" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Prefix (e.g., 10.0.0.0)"
                              />
                            </div>
                            <div className="host-selection__dropdown-group">
                              <label>Subnet:</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.staticRoute1?.subnet || ""}
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    { group: "staticRoute1", key: "subnet" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Subnet Mask (e.g., 255.255.255.0)"
                              />
                            </div>
                            <div className="host-selection__dropdown-group">
                              <label>Next Hop:</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.staticRoute1?.nextHop || ""}
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    { group: "staticRoute1", key: "nextHop" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Next Hop IP Address"
                              />
                            </div>
                          </div>
                          <div className="line-vertical-rt-rt"></div>
                          <div className="static-route-section">
                            <h5>Static Route for Host 2</h5>
                            <div className="host-selection__dropdown-group">
                              <label>Prefix:</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.staticRoute2?.prefix || ""}
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    { group: "staticRoute2", key: "prefix" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Prefix (e.g., 10.0.0.0)"
                              />
                            </div>
                            <div className="host-selection__dropdown-group">
                              <label>Subnet:</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.staticRoute2?.subnet || ""}
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    { group: "staticRoute2", key: "subnet" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Subnet Mask (e.g., 255.255.255.0)"
                              />
                            </div>
                            <div className="host-selection__dropdown-group">
                              <label>Next Hop:</label>
                              <input
                                type="text"
                                className="host-selection__dropdown"
                                value={link.staticRoute2?.nextHop || ""}
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    { group: "staticRoute2", key: "nextHop" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Next Hop IP Address"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="line-container">
            <div className="line"></div>
            <button
              onClick={handleAddLink}
              className={`button-sw-sw-add ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner color="white" size="small" />
                  <span className="fetching-text">Fetching Data...</span>
                </>
              ) : (
                "+ Add Router-Router Link"
              )}
            </button>
            <div className="line"></div>
          </div>
        </div>

        <div className="submit-sw-sw-container">
          <button
            className="button-sw-sw-submit"
            onClick={handleSubmitAll}
            disabled={loading}
          >
            Verify
          </button>

          {/* Popup Summary */}
          {!error && showPopup && (
            <div className="popup-overlay">
              <div className="popup-preview">
                <h1 style={{ fontSize: "32px" }}>Summary</h1>
                <div className="topology-prev">
                  <h5 style={{ margin: "10px 20px" }}>Network Topology</h5>
                  <NetworkTopology links={links} />
                </div>
                <div className="popup-table-section">
                  {Object.entries(routingTables).map(
                    ([hostname, routes]: [string, any]) => (
                      <div className="popup-table" key={hostname}>
                        <h5>{hostname} Routing Table</h5>
                        <div className="popup-table-wrapper">
                          <table
                            border={1}
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                            }}
                          >
                            <thead>
                              <tr>
                                <th>Destination Network</th>
                                <th>Next Hop</th>
                                <th>Outgoing Interface</th>
                                <th>Link</th>
                                <th>Protocol</th>
                              </tr>
                            </thead>
                            <tbody>
                              {routes.map((row: any, index: number) => (
                                <tr key={index}>
                                  <td>{row.subnet}</td>
                                  <td>{row.nexthop}</td>
                                  <td>{row.outgoing_interface}</td>
                                  <td>{row.link}</td>
                                  <td>{row.protocol}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  )}
                </div>
                <div className="button-prev-section">
                  <button
                    className="button-cancel-prev"
                    style={{ fontSize: "16px" }}
                    onClick={handleClosePopup}
                  >
                    Cancel
                  </button>
                  <button
                    className="button-confirm-prev"
                    style={{ fontSize: "16px" }}
                    onClick={handleConfirm}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SHOW COMPARISON POPUP */}
        {showComparisonPopup && (
          <div className="popup-overlay">
            <div className="popup-preview" style={{ height: "90%" }}>
              {isLoading ? (
                <div style={{ height: "100%" }}>
                  <h1 style={{ fontSize: "38px" }}>Result</h1>
                  <div className="loading-container">
                    <div className="spinner-lab" />
                    <p>Loading...</p>
                  </div>
                </div>
              ) : (
                <div style={{ height: "100%" }}>
                  <h1 style={{ fontSize: "38px" }}>Result</h1>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0px 10px",
                      height: "72vh",
                    }}
                  >
                    {/* APPLIED ON DEVICE SECTION */}
                    <div
                      style={{
                        width: "48%",
                        backgroundColor: "#e6f7ff", // Light bluish background
                        padding: "10px",
                        border: "1px solid #b3daff",
                        borderRadius: "5px",
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>Applied on device:</h4>
                      <div
                        className="popup-table-section-result"
                        style={{ maxHeight: "65vh", overflowY: "auto" }}
                      >
                        {Object.entries(comparisonResult).map(
                          ([hostname, compData]: [string, any]) => (
                            <div
                              key={hostname}
                              className="popup-table"
                              style={{
                                marginBottom: "20px",
                                backgroundColor: "#ffffff",
                                borderRadius: "4px",
                                padding: "10px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <h5>{hostname}</h5>
                                <p style={{ color: compData.all_matched ? "green" : "red", marginBottom: 0 }}>
                                  {compData.all_matched ? "Matched" : "Unmatched"}
                                </p>
                              </div>
                              {compData.matched_entries &&
                                compData.matched_entries.length > 0 ? (
                                <div className="popup-table-wrapper" style={{ overflowX: "auto" }}>
                                  <table
                                    border={1}
                                    style={{
                                      width: "100%",
                                      borderCollapse: "collapse",
                                      backgroundColor: "#fff",
                                    }}
                                  >
                                    <thead>
                                      <tr style={{ backgroundColor: "#f0f8ff" }}>
                                        <th>Protocol</th>
                                        <th>Subnet</th>
                                        <th>Next Hop</th>
                                        <th>Outgoing Interface</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {compData.matched_entries.map((entry: any, index: number) => (
                                        <tr key={index}>
                                          <td>{entry.protocol}</td>
                                          <td>{entry.subnet}</td>
                                          <td>{entry.nexthop}</td>
                                          <td>{entry.outgoing_interface}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p>No matched entries.</p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* CONFIGURATION SENT SECTION */}
                    <div
                      style={{
                        width: "48%",
                        backgroundColor: "#fff9e6", // Light yellowish background
                        padding: "10px",
                        border: "1px solid #ffe6b3",
                        borderRadius: "5px",
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>Configuration sent:</h4>
                      <div
                        className="popup-table-section-result"
                        style={{ maxHeight: "65vh", overflowY: "auto" }}
                      >
                        {Object.entries(routingTables).map(
                          ([hostname, routes]: [string, any]) => (
                            <div
                              key={hostname}
                              className="popup-table"
                              style={{
                                marginBottom: "20px",
                                backgroundColor: "#ffffff",
                                borderRadius: "4px",
                                padding: "10px",
                              }}
                            >
                              <h5>{hostname}</h5>
                              <div
                                className="popup-table-wrapper"
                                style={{ overflowX: "auto" }}
                              >
                                <table
                                  border={1}
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  <thead>
                                    <tr style={{ backgroundColor: "#fff2e6" }}>
                                      <th>Protocol</th>
                                      <th>Subnet</th>
                                      <th>Next Hop</th>
                                      <th>Outgoing Interface</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {routes.map((route: any, i: number) => (
                                      <tr key={i}>
                                        <td>{route.protocol}</td>
                                        <td>{route.subnet}</td>
                                        <td>{route.nexthop}</td>
                                        <td>{route.outgoing_interface}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="button-prev-section">
                    <button
                      className="button-cancel-prev"
                      style={{ fontSize: "15px" }}
                      onClick={() => setShowComparisonPopup(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

              )}
            </div>
          </div>
        )}


        {error && (
          <div className="popup-overlay">
            <div className="popup-content-host">
              <div className="error-rt-rt">{error}</div>
              <button
                className="cancel-btn"
                onClick={() => {
                  setError("");
                  setShowPopup(false);
                }}
              >
                close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RouterRouter;
