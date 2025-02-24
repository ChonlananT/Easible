import React, { useState, useEffect } from "react";
import "./Bar.css";
import "./RouterRouter.css";
import "./ConfigDevice.css";
import "./SwitchSwitch.css";
import "./Lab.css";
import Spinner from "./bootstrapSpinner.tsx";
import { ArrowLeftFromLine, ChevronDown, Menu } from "lucide-react";
import Navbar from "./Navbar.tsx";
import { radialGradient } from "framer-motion/client";

// Type Definitions
type GetHostsData = {
  deviceType: string;
  enablePassword: string;
  hostname: string;
  id: number;
  ipAddress: string;
  password: string;
  username: string;
};

type ShowDetailData = {
  hostname: string;
  interfaces: {
    interface: string;
    detail: {
      ip_address: string;
      status: string;
    };
  }[];
  vlans?: VlanInfo[];
  lldp_neighbors?: LldpNeighbors[];
};

export type VlanInfo = {
  vlan_id: number;
  stp_detail?: {
    root_mac: string;
    bridge_priority_in_brackets: string;
    bridge_mac: string;
    isRoot: boolean;
    stp_interfaces?: {
      interface: string;
      interface_role: string;
      cost: string;
      bpdu_port?: number;
    }[];
  };
};

export type StpResult = {
  hostname: string;
  vlan_id: number;
  stp_detail?: {
    root_mac: string;
    bridge_priority_in_brackets: string;
    bridge_mac: string;
    isRoot: boolean;
    stp_interfaces?: {
      interface: string;
      interface_role: string;
      cost: string;
      bpdu_port?: number;
    }[];
  };
};

export type LldpNeighbors = {
  local_hostname: string;
  local_intf: string;
  remote_device: string;
  remote_intf: string;
};

type DropdownOption = {
  hostname: string;
  deviceType: string;
  interfaces: {
    interface: string;
    ip_address: string;
    status: string;
  }[];
  vlans?: VlanInfo[];
};

type VlanData = {
  vlanId: string;
  vlanName?: string;
  ipAddress?: string;
  cidr?: number;
  interface: string;
  mode: string;
};

type BridgePriorityData = {
  vlan: number; // เลือก vlan_id จาก dropdown
  priority: number; // ผู้ใช้สามารถเลือก override ค่า priority ได้
};

type ConfigIpData = {
  interface: string;
  ipAddress: string;
  cidr: number;
};

type LoopbackData = {
  loopbackNumber: number;
  ipAddress: string;
  activateProtocol: string;
};

type StaticRouteData = {
  prefix: string;
  cidr: number;
  nextHop: string;
};

// HostConfig Type
type HostConfig = {
  deviceType: string;
  selectedHost: string;
  selectedCommand: string;
  vlanData?: VlanData;
  bridgePriority?: BridgePriorityData;
  configIp?: ConfigIpData;
  loopbackData?: LoopbackData;
  staticRouteData?: StaticRouteData;
};

type SummaryPopupProps = {
  stpResults: StpResult[];
  resultData?: any;
  selectedCommand: string;
  userInputs: HostConfig[];
  result_loading: boolean; // new prop for loading state
  onClose: () => void;
};

// Helper function: คำนวณ classful network address
function calculateClassfulNetwork(ipAddress: string): string {
  const parts = ipAddress.split(".");
  if (parts.length !== 4) return ipAddress; // ถ้าไม่ครบ 4 octet ให้คืนค่าเดิม
  const firstOctet = parseInt(parts[0], 10);
  if (firstOctet < 128) { // Class A
    return `${parts[0]}.0.0.0`;
  } else if (firstOctet < 192) { // Class B
    return `${parts[0]}.${parts[1]}.0.0`;
  } else { // Class C
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
}

function ConfigDevice() {
  const [hostsFromGetHosts, setHostsFromGetHosts] = useState<GetHostsData[]>(
    []
  );
  const [detailsByType, setDetailsByType] = useState<{
    [deviceType: string]: ShowDetailData[];
  }>({});
  const [combinedHosts, setCombinedHosts] = useState<DropdownOption[]>([]);
  const [links, setLinks] = useState<HostConfig[]>([]);
  const [vlans, setVlans] = useState<{ [key: string]: VlanInfo[] }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<boolean>(true);
  const [resultData, setResultData] = useState<any>(null);
  const [selectedCommand, setSelectedCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);


  // Commands available by device type
  const commandsByDeviceType: {
    [key: string]: { label: string; value: string }[];
  } = {
    switch: [
      { label: "VLAN", value: "vlan" },
      { label: "Bridge Priority", value: "bridge_priority" },
    ],
    router: [
      { label: "Config IP Router", value: "config_ip_router" },
      { label: "Loopback", value: "loopback" },
      { label: "Static Route", value: "static_route" },
    ],
  };

  const deviceTypes = [
    { label: "-- Select Device Type --", value: "" },
    { label: "Switch", value: "switch" },
    { label: "Router", value: "router" },
  ];

  const commandMapping = {
    vlan: "Vlan",
    config_ip_router: "Config IP Router",
    loopback: "Loopback",
    static_route: "Static Route",
    bridge_priority: "Bridge Priority"
  };
  

  const renderDetails = (input: HostConfig) => {
    switch (input.selectedCommand) {
      case "vlan":
        if (input.vlanData) {
          return (
            <div
              style={{
                margin: 0,
                paddingLeft: "10px",
                lineHeight: "1.5",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start"
              }}
            >
              <div>
                <strong>VLAN ID:</strong> {input.vlanData.vlanId}
              </div>
              <div>
                <strong>VLAN Name:</strong> {input.vlanData.vlanName || "-"}
              </div>
              <div>
                <strong>Interface:</strong> {input.vlanData.interface}
              </div>
              <div>
                <strong>Mode:</strong> {input.vlanData.mode}
              </div>
              <div>
                <strong>IP Address:</strong> {input.vlanData.ipAddress || "-"}
              </div>
              <div>
                <strong>CIDR:</strong> {input.vlanData.cidr}
              </div>
            </div>
          );
        }
        break;
      case "config_ip_router":
        if (input.configIp) {
          return (
            <div
              style={{
                margin: 0,
                paddingLeft: "10px",
                lineHeight: "1.5",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start"
              }}
            >
              <div>
                <strong>Interface:</strong> {input.configIp.interface}
              </div>
              <div>
                <strong>IP Address:</strong> {input.configIp.ipAddress}
              </div>
              <div>
                <strong>CIDR:</strong> {input.configIp.cidr}
              </div>
            </div>
          );
        }
        break;
      case "loopback":
        if (input.loopbackData) {
          const displayIp =
        input.loopbackData.activateProtocol === "ripv2"
          ? calculateClassfulNetwork(input.loopbackData.ipAddress)
          : input.loopbackData.ipAddress;
          return (
            <div
              style={{
                margin: 0,
                paddingLeft: "10px",
                lineHeight: "1.5",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start"
              }}
            >
              <div>
                <strong>Loopback Number:</strong> {input.loopbackData.loopbackNumber}
              </div>
              <div>
                <strong>IP Address:</strong> {input.loopbackData.ipAddress}
              </div>
              <div>
                <strong>Protocol Activation:</strong> {input.loopbackData.activateProtocol}
              </div>
            </div>
          );
        }
        break;
      case "static_route":
        if (input.staticRouteData) {
          return (
            <div
              style={{
                margin: 0,
                paddingLeft: "10px",
                lineHeight: "1.5",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start"
              }}
            >
              <div>
                <strong>Prefix:</strong> {input.staticRouteData.prefix}
              </div>
              <div>
                <strong>CIDR:</strong> {input.staticRouteData.cidr}
              </div>
              <div>
                <strong>Next Hop:</strong> {input.staticRouteData.nextHop}
              </div>
            </div>
          );
        }
        break;
      default:
        return <span>-</span>;
    }

    return <span>-</span>;
  };

  const SummaryPopup: React.FC<SummaryPopupProps> = ({
    stpResults,
    resultData,
    selectedCommand,
    userInputs,
    onClose,
  }) => {
    // If resultData exists, show the result view as before.
    if (resultData || isLoading) {
      if (selectedCommand === "bridge_priority") {
        if (
          resultData.comparison &&
          Array.isArray(resultData.comparison) &&
          resultData.comparison.length > 0 &&
          resultData.comparison[0].match === true
        ) {
          const sortedByHostname = [...stpResults].sort((a, b) =>
            a.hostname.localeCompare(b.hostname)
          );
          const sortedResults = sortedByHostname.sort((a, b) => {
            if (a.stp_detail?.isRoot && !b.stp_detail?.isRoot) return -1;
            if (!a.stp_detail?.isRoot && b.stp_detail?.isRoot) return 1;
            return 0;
          });
          return (
            <div className="popup-overlay">
              <div className="popup-preview">
                <h2 className="summary-title">Result</h2>
                <div className="summary-content-cd">
                  {sortedResults.map((sw, index) => (
                    <div key={index} className="switch-card">
                      <div
                        className={`switch-header ${sw.stp_detail?.isRoot ? "root-bridge" : ""
                          }`}
                      >
                        <div style={{ display: "flex" }}>
                          <strong>{sw.hostname}</strong> – VLAN {sw.vlan_id}
                          {sw.stp_detail?.isRoot && (
                            <span className="root-label"> Root Bridge</span>
                          )}
                        </div>
                        <div style={{ display: "flex" }}>
                          Bridge Priority:
                          <div style={{ marginLeft: "5px", color: "royalblue" }}>
                            {sw.stp_detail?.bridge_priority_in_brackets}
                          </div>
                        </div>
                        <div style={{ display: "flex" }}>
                          MAC Address:
                          <div style={{ marginLeft: "5px", color: "royalblue" }}>
                            {sw.stp_detail?.bridge_mac}
                          </div>
                        </div>
                      </div>
                      {sw.stp_detail?.stp_interfaces && (
                        <table className="switch-table">
                          <thead>
                            <tr>
                              <th>Port</th>
                              <th>STP Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sw.stp_detail.stp_interfaces.map((port, idx) => (
                              <tr key={idx}>
                                <td>{port.interface}</td>
                                <td>{port.interface_role}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
                <button className="button-cancel-prev" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          );
        } else {
          return (
            <div className="popup-overlay">
              <div className="popup-preview">
                <h2 className="summary-title">Result</h2>
                {"No comparison data."}
                <button className="button-cancel-prev" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          );
        }
      } else {
        // For non-bridge_priority commands, show the resultData as JSON.
        return (
          <div className="popup-overlay">
            <div className="popup-preview">
              <h2 className="summary-title">Result</h2>
              {isLoading ? (
                <div className="loading-container">
                  <div className="spinner-lab" />
                  <p>Loading...</p>
                </div>
              ) : (
                <pre>{JSON.stringify(resultData, null, 2)}</pre>
              )}
              <button className="button-cancel-prev" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        );
      }
    }

    // If no resultData exists, show a summary table of the user inputs.
    return (
      <div className="popup-overlay">
        <div className="popup-preview">
          {/* If spanning tree data exists, show that */}
          {stpResults.length > 0 ? (
            <>
              <h2 className="summary-title">Spanning Tree Summary</h2>
              {stpResults.map((sw, index) => (
                <div key={index} className="switch-card">
                  <div
                    className={`switch-header ${sw.stp_detail?.isRoot ? "root-bridge" : ""
                      }`}
                  >
                    <div style={{ display: "flex" }}>
                      <strong>{sw.hostname}</strong> – VLAN {sw.vlan_id}
                      {sw.stp_detail?.isRoot && (
                        <span className="root-label"> Root Bridge</span>
                      )}
                    </div>
                    <div style={{ display: "flex" }}>
                      Bridge Priority:
                      <div style={{ marginLeft: "5px", color: "royalblue" }}>
                        {sw.stp_detail?.bridge_priority_in_brackets}
                      </div>
                    </div>
                    <div style={{ display: "flex" }}>
                      MAC Address:
                      <div style={{ marginLeft: "5px", color: "royalblue" }}>
                        {sw.stp_detail?.bridge_mac}
                      </div>
                    </div>
                  </div>
                  {sw.stp_detail?.stp_interfaces && (
                    <table className="switch-table">
                      <thead>
                        <tr>
                          <th>Port</th>
                          <th>STP Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sw.stp_detail.stp_interfaces.map((port, idx) => (
                          <tr key={idx}>
                            <td>{port.interface}</td>
                            <td>{port.interface_role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </>
          ) : (
            // Otherwise, show the configuration summary table.
            <>
              <h2 className="summary-title">Summary</h2>
              <div style={{ overflowY: "auto", maxHeight: "75vh", marginBottom: "20px" }}>
                <div className="popup-table-wrapper" style={{ marginBottom: "20px" }}>
                  <table className="summary-table" style={{ width: "100%", border: "none" }} border={1}>
                    <thead>
                      <tr>
                        <th>Device Type</th>
                        <th>Selected Host</th>
                        <th>Command</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userInputs.map((input, idx) => (
                        <tr key={idx}>
                          <td>{input.deviceType}</td>
                          <td>{input.selectedHost}</td>
                          <td>{commandMapping[input.selectedCommand] || input.selectedCommand}</td>
                          <td>{renderDetails(input)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              className="button-cancel-prev"
              style={{ fontSize: "16px", padding: "4px 15px" }}
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="button-confirm-prev"
              style={{ fontSize: "16px", padding: "4px 15px" }}
              onClick={handleConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>

    );
  };

  // Fetch get_hosts on mount
  useEffect(() => {
    setLoading(true);
    fetch("/api/get_hosts")
      .then((res) => {
        if (!res.ok)
          throw new Error(
            `GET /api/get_hosts failed with status ${res.status}`
          );
        return res.json();
      })
      .then((getHostsData) => {
        setHostsFromGetHosts(getHostsData);
        setLinks([{ deviceType: "", selectedHost: "", selectedCommand: "" }]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Combine host and detail data
  const combineHostsData = () => {
    const combined = hostsFromGetHosts
      .map((host) => {
        const details = detailsByType[host.deviceType];
        if (details) {
          // Log what we're finding for each host.
          const detail = details.find((d) => d.hostname === host.hostname);
          if (detail) {
            return {
              hostname: host.hostname,
              deviceType: host.deviceType,
              interfaces: detail.interfaces.map((intf) => ({
                interface: intf.interface,
                ip_address: intf.detail.ip_address,
                status: intf.detail.status,
              })),
              vlans: detail.vlans || [],
              lldp_neighbors: detail.lldp_neighbors || [],
            };
          }
        }
        return null;
      })
      .filter((host) => host !== null) as DropdownOption[];

    setCombinedHosts(combined);

    const tempVlans: { [key: string]: VlanInfo[] } = {};
    combined.forEach((host) => {
      tempVlans[host.hostname] = host.vlans || [];
    });

    setVlans(tempVlans);
  };

  useEffect(() => {
    combineHostsData();
  }, [hostsFromGetHosts, detailsByType]);

  const getRootInfo = (
    vlanId: number
  ): { hostname: string; priority: string } | null => {
    for (let host of combinedHosts) {
      if (host.vlans) {
        const found = host.vlans.find(
          (v) =>
            v.vlan_id === vlanId && v.stp_detail && v.stp_detail.isRoot === true
        );
        if (found && found.stp_detail) {
          return {
            hostname: host.hostname,
            priority: found.stp_detail.bridge_priority_in_brackets,
          };
        }
      }
    }
    return null;
  };

  const getCurrentHostPriority = (
    selectedHost: string,
    vlanId: number
  ): string | null => {
    const hostData = combinedHosts.find(
      (host) => host.hostname === selectedHost
    );
    if (hostData && hostData.vlans) {
      const vlanObj = hostData.vlans.find((v) => v.vlan_id === vlanId);
      if (vlanObj && vlanObj.stp_detail) {
        return vlanObj.stp_detail.bridge_priority_in_brackets;
      }
    }
    return null;
  };

  const handleHostChange = (
    hostIndex: number,
    field:
      | keyof HostConfig
      | {
        group:
        | "vlanData"
        | "bridgePriority"
        | "configIp"
        | "loopbackData"
        | "staticRouteData";
        key: string;
      },
    value: string | number
  ) => {
    setLinks((prevLinks) => {
      const newLinks = [...prevLinks];
      const hostConfig = { ...newLinks[hostIndex] };

      if (typeof field === "string") {
        (hostConfig as any)[field] = value;

        if (field === "deviceType") {
          hostConfig.selectedHost = "";
          hostConfig.selectedCommand = "";
          delete hostConfig.vlanData;
          delete hostConfig.bridgePriority;
          delete hostConfig.configIp;
          delete hostConfig.loopbackData;
          delete hostConfig.staticRouteData;

          if (value === "switch" || value === "router") {
            if (!detailsByType[value]) {
              fetch("/api/show_detail_configdevice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceType: value }),
              })
                .then((res) => {
                  if (!res.ok)
                    throw new Error(
                      `POST /api/show_detail_configdevice failed with status ${res.status}`
                    );
                  return res.json();
                })
                .then((data) => {
                  setDetailsByType((prev) => ({
                    ...prev,
                    [value]: data.parsed_result,
                  }));
                })
                .catch((err) => setError(err.message));
            }
          }
        }

        if (field === "selectedCommand") {
          if (value === "vlan") {
            hostConfig.vlanData = {
              vlanId: "",
              vlanName: "",
              ipAddress: "",
              cidr: 24,
              interface: "",
              mode: "",
            };
          } else if (value === "bridge_priority") {
            hostConfig.bridgePriority = {
              vlan: 0,
              priority: 0,
            };
          } else if (value === "config_ip_router") {
            hostConfig.configIp = {
              interface: "",
              ipAddress: "",
              cidr: 24,
            };
          } else if (value === "loopback") {
            hostConfig.loopbackData = {
              loopbackNumber: 0,
              ipAddress: "",
              activateProtocol: ""
            };
          } else if (value === "static_route") {
            hostConfig.staticRouteData = {
              prefix: "",
              cidr: 24,
              nextHop: "",
            };
          } else {
            delete hostConfig.vlanData;
            delete hostConfig.bridgePriority;
            delete hostConfig.configIp;
            delete hostConfig.loopbackData;
          }
        }
      } else {
        if (field.group === "vlanData") {
          hostConfig.vlanData = {
            ...hostConfig.vlanData!,
            [field.key]: value,
          };
        } else if (field.group === "bridgePriority") {
          hostConfig.bridgePriority = {
            ...hostConfig.bridgePriority!,
            [field.key]: value,
          };
        } else if (field.group === "configIp") {
          hostConfig.configIp = {
            ...hostConfig.configIp!,
            [field.key]: value,
          };
        } else if (field.group === "loopbackData") {
          hostConfig.loopbackData = {
            ...hostConfig.loopbackData!,
            [field.key]: value,
          };
        } else if (field.group === "staticRouteData") {
          hostConfig.staticRouteData = {
            ...hostConfig.staticRouteData!,
            [field.key]: value,
          };
        }
      }

      newLinks[hostIndex] = hostConfig;
      return newLinks;
    });
  };

  const getInterfacesForHost = (hostname: string) => {
    const host = combinedHosts.find((item) => item.hostname === hostname);
    return host ? host.interfaces : [];
  };

  const handleAddHost = () => {
    if (links.some((link) => link.selectedCommand === "bridge_priority")) {
      setError("Cannot add new host when Bridge Priority is selected.");
      return;
    }
    setLinks((prevLinks) => [
      ...prevLinks,
      {
        deviceType: "",
        selectedHost: "",
        selectedCommand: "",
      },
    ]);
  };


  const handleRemoveHost = (hostIndex: number) => {
    setLinks((prevLinks) => prevLinks.filter((_, i) => i !== hostIndex));
  };

  const handleSubmitAll = () => {
    setError("");

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link.deviceType || !link.selectedHost || !link.selectedCommand) {
        setError(
          `Please select device type, host, and command for all entries.`
        );
        return;
      }

      if (link.selectedCommand === "vlan") {
        const vlan = link.vlanData;
        if (!vlan || !vlan.vlanId || !vlan.interface || !vlan.mode) {
          setError(`Please fill all required VLAN fields for entry ${i + 1}.`);
          return;
        }
      }

      if (link.selectedCommand === "bridge_priority") {
        const bridge = link.bridgePriority;
        if (!bridge || bridge.vlan === 0) {
          setError(
            `Please fill all required Bridge Priority fields for entry ${i + 1
            }.`
          );
          return;
        }
      }

      if (link.selectedCommand === "config_ip_router") {
        const configIp = link.configIp;
        if (
          !configIp ||
          !configIp.interface ||
          !configIp.ipAddress ||
          !configIp.cidr
        ) {
          setError(
            `Please fill all required Config IP fields for entry ${i + 1}.`
          );
          return;
        }
      }

      if (link.selectedCommand === "loopback") {
        const loopback = link.loopbackData;
        if (!loopback || !loopback.loopbackNumber || !loopback.ipAddress || !loopback.activateProtocol) {
          setError(
            `Please fill all required Loopback fields for entry ${i + 1}.`
          );
          return;
        }
      }

      if (link.selectedCommand === "static_route") {
        const static_route = link.staticRouteData;
        if (
          !static_route ||
          !static_route.prefix ||
          !static_route.cidr ||
          !static_route.nextHop
        ) {
          setError(
            `Please fill all required Static route fields for entry ${i + 1}.`
          );
          return;
        }
      }
    }

    const requestData = links.map((link) => ({
      deviceType: link.deviceType,
      hostname: link.selectedHost,
      command: link.selectedCommand,
      ...(link.selectedCommand === "vlan" && link.vlanData
        ? {
          vlanDataList: [
            {
              vlanId: link.vlanData.vlanId,
              vlanName: link.vlanData.vlanName,
              ipAddress: link.vlanData.ipAddress,
              cidr: link.vlanData.cidr,
              interfaces: [
                {
                  interface: link.vlanData.interface,
                  mode: link.vlanData.mode,
                },
              ],
            },
          ],
        }
        : {}),
      ...(link.selectedCommand === "bridge_priority" && link.bridgePriority
        ? {
          bridgePriority: {
            vlan: link.bridgePriority.vlan,
            priority: link.bridgePriority.priority,
          },
          parsed_result: [...combinedHosts],
        }
        : {}),
      ...(link.selectedCommand === "config_ip_router" && link.configIp
        ? {
          configIp: {
            interface: link.configIp.interface,
            ipAddress: link.configIp.ipAddress,
            cidr: link.configIp.cidr,
          },
        }
        : {}),
      ...(link.selectedCommand === "loopback" && link.loopbackData
        ? {
          loopbackData: {
            loopbackNumber: link.loopbackData.loopbackNumber,
            ipAddress: link.loopbackData.activateProtocol === "ripv2"
            ? calculateClassfulNetwork(link.loopbackData.ipAddress)
            : link.loopbackData.ipAddress,
            activateProtocol: link.loopbackData.activateProtocol
          },
        }
        : {}),
      ...(link.selectedCommand === "static_route" && link.staticRouteData
        ? {
          staticRouteData: {
            prefix: link.staticRouteData.prefix,
            cidr: link.staticRouteData.cidr,
            nextHop: link.staticRouteData.nextHop,
          },
        }
        : {}),
    }));

    fetch("/api/create_playbook_configdevice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setStpResults(data.stp_result || []); // Store STP results in state
          setBridgeOpen(true); // Open the summary popup
          console.log("Playbook created:", data.playbook);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error("Error submitting configuration:", err);
      });
  };

  const handleConfirm = () => {
    setError("");
    setIsLoading(true);
    // ตรวจสอบความสมบูรณ์ของข้อมูลในแต่ละ entry ใน links
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link.deviceType || !link.selectedHost || !link.selectedCommand) {
        setError(
          `Please select device type, host, and command for all entries.`
        );
        return;
      }

      if (link.selectedCommand === "vlan") {
        const vlan = link.vlanData;
        if (!vlan || !vlan.vlanId || !vlan.interface || !vlan.mode) {
          setError(`Please fill all required VLAN fields for entry ${i + 1}.`);
          return;
        }
      }

      if (link.selectedCommand === "bridge_priority") {
        const bridge = link.bridgePriority;
        if (!bridge || bridge.vlan === 0) {
          setError(
            `Please fill all required Bridge Priority fields for entry ${i + 1
            }.`
          );
          return;
        }
      }

      if (link.selectedCommand === "config_ip_router") {
        const configIp = link.configIp;
        if (
          !configIp ||
          !configIp.interface ||
          !configIp.ipAddress ||
          !configIp.cidr
        ) {
          setError(
            `Please fill all required Config IP fields for entry ${i + 1}.`
          );
          return;
        }
      }

      if (link.selectedCommand === "loopback") {
        const loopback = link.loopbackData;
        if (!loopback || !loopback.loopbackNumber || !loopback.ipAddress || !loopback.activateProtocol) {
          setError(
            `Please fill all required Loopback fields for entry ${i + 1}.`
          );
          return;
        }
      }

      if (link.selectedCommand === "static_route") {
        const staticRoute = link.staticRouteData;
        if (
          !staticRoute ||
          !staticRoute.prefix ||
          !staticRoute.cidr ||
          !staticRoute.nextHop
        ) {
          setError(
            `Please fill all required Static Route fields for entry ${i + 1}.`
          );
          return;
        }
      }
    }

    // เก็บ command จาก entry ตัวแรก
    const commandType = links[0].selectedCommand;
    setSelectedCommand(commandType);

    // Mapping request data ตาม structure ที่ต้องการ
    const requestData = links.map((link) => ({
      deviceType: link.deviceType,
      hostname: link.selectedHost,
      command: link.selectedCommand,
      ...(link.selectedCommand === "vlan" && link.vlanData
        ? {
          vlanDataList: [
            {
              vlanId: link.vlanData.vlanId,
              vlanName: link.vlanData.vlanName,
              ipAddress: link.vlanData.ipAddress,
              cidr: link.vlanData.cidr,
              interfaces: [
                {
                  interface: link.vlanData.interface,
                  mode: link.vlanData.mode,
                },
              ],
            },
          ],
        }
        : {}),
      ...(link.selectedCommand === "bridge_priority" && link.bridgePriority
        ? {
          bridgePriority: {
            vlan: link.bridgePriority.vlan,
            priority: link.bridgePriority.priority,
          },
          parsed_result: [...combinedHosts],
        }
        : {}),
      ...(link.selectedCommand === "config_ip_router" && link.configIp
        ? {
          configIp: {
            interface: link.configIp.interface,
            ipAddress: link.configIp.ipAddress,
            cidr: link.configIp.cidr,
          },
        }
        : {}),
      ...(link.selectedCommand === "loopback" && link.loopbackData
        ? {
          loopbackData: {
            loopbackNumber: link.loopbackData.loopbackNumber,
            ipAddress: link.loopbackData.activateProtocol === "ripv2"
            ? calculateClassfulNetwork(link.loopbackData.ipAddress)
            : link.loopbackData.ipAddress,
            activateProtocol: link.loopbackData.activateProtocol
          },
        }
        : {}),
      ...(link.selectedCommand === "static_route" && link.staticRouteData
        ? {
          staticRouteData: {
            prefix: link.staticRouteData.prefix,
            cidr: link.staticRouteData.cidr,
            nextHop: link.staticRouteData.nextHop,
          },
        }
        : {}),
    }));

    console.log('Confirming configuration to backend:', requestData);

    // เรียก API /api/run_playbook/configdevice ด้วย method POST
    fetch("/api/run_playbook/configdevice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setResultData(data);
          // เปิด popup เมื่อได้รับข้อมูล
          setBridgeOpen(true);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error("Error executing configuration:", err);
      })
      .finally(() => setIsLoading(false));
  };

  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem("isNavOpen");
    return savedNavState === "true";
  });

  useEffect(() => {
    localStorage.setItem("isNavOpen", isNavOpen.toString());
  }, [isNavOpen]);

  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () => {
    setIsNavDropdownOpen(!isNavDropdownOpen);
  };

  const [isBridgeOpen, setBridgeOpen] = useState(false);
  const handleToggleBridge = () => {
    setBridgeOpen(!isBridgeOpen);
  };

  // For demo purposes, we simulate stpResults.
  // const stpResults: VlanInfo[] = combinedHosts.reduce((acc: VlanInfo[], host) => {
  //   if (host.vlans) {
  //     host.vlans.forEach((vlan) => acc.push(vlan));
  //   }
  //   return acc;
  // }, []);
  const [stpResults, setStpResults] = useState<StpResult[]>([]);

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
          Configure Devices
          {/* <span className="content-topic-small"> (Config Device)</span> */}
        </div>
        <div className="content-board">
          <div className="all-links">
            {links.map((link, index) => (
              <div key={index} className="switch-switch">
                <div className="top-link">
                  <div className="link-index">Device Config {index + 1}</div>
                  <div className="remove-link-container">
                    {links.length > 1 && (
                      <button
                        onClick={() => handleRemoveHost(index)}
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
                  <div className="host-selection-container">
                    <div className="host-selection__hosts">
                      <div className="host-selection__dropdown-group">
                        <label>Select Device Type:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.deviceType}
                          onChange={(e) =>
                            handleHostChange(
                              index,
                              "deviceType",
                              e.target.value
                            )
                          }
                        >
                          {deviceTypes.map((dt) => (
                            <option key={dt.value} value={dt.value}>
                              {dt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="host-selection__dropdown-group">
                        <label>Select Device:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.selectedHost}
                          onChange={(e) =>
                            handleHostChange(
                              index,
                              "selectedHost",
                              e.target.value
                            )
                          }
                          disabled={
                            !link.deviceType ||
                            loading ||
                            combinedHosts.filter(
                              (host) => host.deviceType === link.deviceType
                            ).length <= 1
                          }
                        >
                          <option value="">
                            {!link.deviceType
                              ? "-- Select a Device --"
                              : combinedHosts.some(
                                (host) => host.deviceType === link.deviceType
                              )
                                ? "-- Select a Device --"
                                : "Loading..."}
                          </option>
                          {combinedHosts
                            .filter(
                              (host) => host.deviceType === link.deviceType
                            )
                            .map((host: DropdownOption) => (
                              <option key={host.hostname} value={host.hostname}>
                                {host.hostname}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="host-selection__dropdown-group">
                        <label>Select Command:</label>
                        <select
                          className="host-selection__dropdown"
                          value={link.selectedCommand}
                          onChange={(e) =>
                            handleHostChange(
                              index,
                              "selectedCommand",
                              e.target.value
                            )
                          }
                          disabled={!link.selectedHost}
                        >
                          <option value="">-- Select a Command --</option>
                          {link.deviceType &&
                            commandsByDeviceType[link.deviceType]
                              .filter((cmd) => {
                                // หากมีมากกว่า 1 hostแล้ว ไม่ให้เลือก bridge_priority ทั้งหมด
                                if (links.length > 1) {
                                  return cmd.value !== "bridge_priority";
                                }
                                return true;
                              })
                              .map((command) => (
                                <option key={command.value} value={command.value}>
                                  {command.label}
                                </option>
                              )
                              )}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="config-command-section">
                    {link.selectedCommand === "vlan" && link.vlanData && (
                      <div className="config-command-board">
                        <div className="vlan-config-topic">
                          <h5>VLAN Configuration</h5>
                        </div>
                        <div className="vlan-config-content">
                          <div className="vlan-config-device">
                            <div className="vlan-name-id">
                              <div className="config-device-input-text">
                                <label>VLAN ID:</label>
                                <input
                                  type="text"
                                  value={link.vlanData.vlanId}
                                  onChange={(e) =>
                                    handleHostChange(
                                      index,
                                      { group: "vlanData", key: "vlanId" },
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter VLAN ID"
                                />
                              </div>
                              <div className="config-device-input-text">
                                <label>VLAN Name (optional):</label>
                                <input
                                  type="text"
                                  value={link.vlanData.vlanName}
                                  onChange={(e) =>
                                    handleHostChange(
                                      index,
                                      { group: "vlanData", key: "vlanName" },
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter VLAN Name"
                                />
                              </div>
                            </div>
                            <div className="ip-subnet-group-confdev">
                              <div className="ip-text">
                                <label>IP Address (optional):</label>
                                <input
                                  type="text"
                                  value={link.vlanData.ipAddress}
                                  onChange={(e) =>
                                    handleHostChange(
                                      index,
                                      { group: "vlanData", key: "ipAddress" },
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter IP Address"
                                />
                              </div>
                              <div className="config-device-input-text">
                                <label>Subnet:</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={32}
                                  value={link.vlanData.cidr}
                                  onChange={(e) =>
                                    handleHostChange(
                                      index,
                                      { group: "vlanData", key: "cidr" },
                                      parseInt(e.target.value, 10)
                                    )
                                  }
                                  placeholder="Enter CIDR (e.g., 24)"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="line-vertical-confdev"></div>
                          <div className="vlan-config-device">
                            <div className="host-selection__dropdown-group">
                              <label>Select Interface:</label>
                              <select
                                className="host-selection__dropdown"
                                value={link.vlanData.interface}
                                onChange={(e) =>
                                  handleHostChange(
                                    index,
                                    { group: "vlanData", key: "interface" },
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">-- Select Interface --</option>
                                {link.selectedHost &&
                                  getInterfacesForHost(link.selectedHost).map(
                                    (intf) => (
                                      <option
                                        key={intf.interface}
                                        value={intf.interface}
                                      >
                                        {intf.interface} ({intf.status})
                                      </option>
                                    )
                                  )}
                              </select>
                            </div>
                            <div className="host-selection__dropdown-group">
                              <label>Mode:</label>
                              <select
                                className="host-selection__dropdown"
                                value={link.vlanData.mode}
                                onChange={(e) =>
                                  handleHostChange(
                                    index,
                                    { group: "vlanData", key: "mode" },
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">-- Select Mode --</option>
                                <option value="trunk">Trunk</option>
                                <option value="access">Access</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {link.selectedCommand === "bridge_priority" &&
                      link.bridgePriority && (
                        <div className="config-command-board">
                          <h5>Bridge Priority Configuration</h5>
                          <div className="host-selection__dropdown-group">
                            <label>Select VLAN:</label>
                            <select
                              className="host-selection__dropdown"
                              value={link.bridgePriority.vlan}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "bridgePriority", key: "vlan" },
                                  parseInt(e.target.value, 10)
                                )
                              }
                            >
                              <option value="">-- Select VLAN --</option>
                              {link.selectedHost &&
                                vlans[link.selectedHost] &&
                                vlans[link.selectedHost].map((vlanObj) => (
                                  <option
                                    key={vlanObj.vlan_id}
                                    value={vlanObj.vlan_id}
                                  >
                                    {`VLAN ${vlanObj.vlan_id}`}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="host-selection__dropdown-group">
                            <label>Bridge Priority:</label>
                            <select
                              className="host-selection__dropdown"
                              value={link.bridgePriority.priority}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "bridgePriority", key: "priority" },
                                  parseInt(e.target.value, 10)
                                )
                              }
                            >
                              <option value="">-- Select Priority --</option>
                              {Array.from(
                                { length: 16 },
                                (_, i) => i * 4096
                              ).map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                          </div>
                          {link.bridgePriority.vlan
                            ? (() => {
                              const rootInfo = getRootInfo(
                                link.bridgePriority.vlan
                              );
                              const hostPriority = getCurrentHostPriority(
                                link.selectedHost,
                                link.bridgePriority.vlan
                              );
                              return (
                                <>
                                  {rootInfo && (
                                    <div
                                      style={{
                                        marginTop: "8px",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Current root: {rootInfo.hostname} | Root
                                      Priority: {rootInfo.priority}
                                    </div>
                                  )}
                                  {hostPriority && (
                                    <div style={{ marginTop: "8px" }}>
                                      Your device's priority: {hostPriority}
                                    </div>
                                  )}
                                </>
                              );
                            })()
                            : null}
                        </div>
                      )}
                    {link.selectedCommand === "config_ip_router" &&
                      link.configIp && (
                        <div className="config-command-board">
                          <h4>Config IP Router</h4>
                          <div className="host-selection__dropdown-group">
                            <label>Select Interface:</label>
                            <select
                              className="host-selection__dropdown"
                              value={link.configIp.interface}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "configIp", key: "interface" },
                                  e.target.value
                                )
                              }
                            >
                              <option value="">-- Select Interface --</option>
                              {link.selectedHost &&
                                getInterfacesForHost(link.selectedHost).map(
                                  (intf) => (
                                    <option
                                      key={intf.interface}
                                      value={intf.interface}
                                    >
                                      {intf.interface} ({intf.status})
                                    </option>
                                  )
                                )}
                            </select>
                          </div>
                          <div className="config-device-input-text">
                            <label>IP Address:</label>
                            <input
                              type="text"
                              value={link.configIp.ipAddress}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "configIp", key: "ipAddress" },
                                  e.target.value
                                )
                              }
                              placeholder="Enter IP Address"
                            />
                          </div>
                          <div className="config-device-input-text">
                            <label>Subnet:</label>
                            <input
                              type="number"
                              min={1}
                              max={32}
                              value={link.configIp.cidr}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "configIp", key: "cidr" },
                                  parseInt(e.target.value, 10)
                                )
                              }
                              placeholder="Enter CIDR (e.g., 24)"
                            />
                          </div>
                        </div>
                      )}
                    {link.selectedCommand === "loopback" && link.loopbackData && (
                      <div className="config-command-board">
                        <h5>Loopback Configuration</h5>
                        <div className="loopback-config-content">
                          <div className="config-device-input-text">
                            <label>Loopback Number:</label>
                            <input
                              type="text"
                              value={link.loopbackData.loopbackNumber}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "loopbackData", key: "loopbackNumber" },
                                  e.target.value
                                )
                              }
                              placeholder="Enter Loopback Number"
                            />
                          </div>
                          <div className="config-device-input-text">
                            <label>IP Address:</label>
                            <input
                              type="text"
                              value={link.loopbackData.ipAddress}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "loopbackData", key: "ipAddress" },
                                  e.target.value
                                )
                              }
                              placeholder="Enter IP Address"
                            />
                          </div>
                          <div className="host-selection__dropdown-group">
                            <label>Protocol Activation:</label>
                            <select
                              className="host-selection__dropdown"
                              value={link.loopbackData.activateProtocol}
                              onChange={(e) =>
                                handleHostChange(
                                  index,
                                  { group: "loopbackData", key: "activateProtocol" },
                                  e.target.value
                                )
                              }
                            >
                              <option value="none">None</option>
                              <option value="ripv2">RIPv2</option>
                              <option value="ospf">OSPF</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {link.selectedCommand === "static_route" &&
                      link.staticRouteData && (
                        <div className="config-command-board">
                          <h5>Static Route Configuration</h5>
                          <div className="loopback-config-content">
                            <div className="config-device-input-text">
                              <label>Prefix:</label>
                              <input
                                type="text"
                                value={link.staticRouteData.prefix}
                                onChange={(e) =>
                                  handleHostChange(
                                    index,
                                    { group: "staticRouteData", key: "prefix" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Prefix"
                              />
                            </div>
                            <div className="config-device-input-text">
                              <label>Subnet mask(CIDR):</label>
                              <input
                                type="text"
                                value={link.staticRouteData.cidr}
                                onChange={(e) =>
                                  handleHostChange(
                                    index,
                                    { group: "staticRouteData", key: "cidr" },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Subnet mask"
                              />
                            </div>
                            <div className="config-device-input-text">
                              <label>Next Hop:</label>
                              <input
                                type="text"
                                value={link.staticRouteData.nextHop}
                                onChange={(e) =>
                                  handleHostChange(
                                    index,
                                    {
                                      group: "staticRouteData",
                                      key: "nextHop",
                                    },
                                    e.target.value
                                  )
                                }
                                placeholder="Enter Next Hop"
                              />
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
              onClick={handleAddHost}
              className={`button-sw-sw-add ${loading ? "loading" : ""}`}
            >
              {loading ? (
                <>
                  <Spinner color="white" size="small" />
                  <span className="fetching-text">Fetching Data...</span>
                </>
              ) : (
                "+ Add Host Config"
              )}
            </button>
            <div className="line"></div>
          </div>
        </div>
        <div className="submit-sw-sw-container">
          <button className="button-sw-sw-submit" onClick={handleSubmitAll}>
            Verify
          </button>
          {isBridgeOpen && (
            <SummaryPopup
              stpResults={stpResults}
              resultData={resultData}
              selectedCommand={selectedCommand}
              userInputs={links}
              result_loading={isLoading}  // pass isLoading as loading prop
              onClose={() => {
                setBridgeOpen(false);
                setResultData(null);
              }}
            />
          )}
        </div>
        {error && (
          <div className="popup-overlay">
            <div className="popup-content-host">
              <div className="error-rt-rt">{error}</div>
              <button
                className="cancel-btn"
                onClick={() => {
                  setError("");
                  // Optionally, if you have a state controlling the popup visibility, reset it here.
                  // setShowPopup(false);
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

export default ConfigDevice;
