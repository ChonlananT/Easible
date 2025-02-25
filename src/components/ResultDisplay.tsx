import React from "react";

type ResultDisplayProps = {
  selectedCommand: string;
  resultData: any;
  // Optional prop for closing the popup if needed
  setShowComparisonPopup?: (show: boolean) => void;
};

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  selectedCommand,
  resultData,
  setShowComparisonPopup,
}) => {
  if (!resultData || !resultData.comparison || resultData.comparison.length === 0) {
    return <div>No result data available.</div>;
  }

  // For simplicity we assume a single comparison result
  const comp = resultData.comparison[0];

  let configFields: Array<{ label: string; value: any }> = [];
  let appliedFields: Array<{ label: string; value: any }> = [];

  // Build the field arrays based on the command type.
  // Hostname and match are removed from these arrays as they will be shown outside.
  switch (selectedCommand) {
    case "vlan":
      configFields = [
        { label: "Interface", value: comp.frontend.vlanDataList[0].interfaces[0].interface },
        { label: "Mode", value: comp.frontend.vlanDataList[0].interfaces[0].mode },
        { label: "VLAN ID", value: comp.frontend.vlanDataList[0].vlanId },
        { label: "VLAN Name", value: comp.frontend.vlanDataList[0].vlanName || "-" },
        { label: "CIDR", value: comp.frontend.vlanDataList[0].cidr },
      ];
      appliedFields = [
        { label: "Interface", value: comp.backend.interface_config.interface },
        { label: "Mode", value: comp.backend.interface_config.mode },
        { label: "VLAN ID", value: comp.backend.vlan_details.vlanId },
        { label: "VLAN Name", value: comp.backend.vlans.vlanName },
        { label: "CIDR", value: comp.backend.vlan_details.cidr },
      ];
      break;

    case "config_ip_router":
      configFields = [
        { label: "Interface", value: comp.frontend.configIp.interface },
        { label: "IP Address", value: comp.frontend.configIp.ipAddress },
        { label: "CIDR", value: comp.frontend.configIp.cidr },
      ];
      appliedFields = [
        { label: "Interface", value: comp.backend.interface },
        { label: "IP Address", value: comp.backend.ipaddress },
        { label: "CIDR", value: comp.backend.cidr },
      ];
      break;

    case "loopback":
      configFields = [
        { label: "Loopback Number", value: comp.frontend.loopbackData.loopbackNumber },
        { label: "IP Address", value: comp.frontend.loopbackData.ipAddress },
        { label: "Activate Protocol", value: comp.frontend.loopbackData.activateProtocol },
      ];
      appliedFields = [
        { label: "Interface", value: comp.backend.interface },
        { label: "IP Address", value: comp.backend.ipaddress },
        { label: "Activate Protocol", value: comp.backend.activateProtocol },
      ];
      break;

    case "static_route":
      configFields = [
        { label: "Prefix", value: comp.frontend.staticRouteData.prefix },
        { label: "CIDR", value: comp.frontend.staticRouteData.cidr },
        { label: "Next Hop", value: comp.frontend.staticRouteData.nextHop },
      ];
      appliedFields = [
        { label: "Prefix", value: comp.backend.prefix },
        { label: "CIDR", value: comp.backend.cidr },
        { label: "Next Hop", value: comp.backend.nexthop },
      ];
      break;

    default:
      return <pre>{JSON.stringify(resultData, null, 2)}</pre>;
  }

  return (
    <div style={{ height: "88%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0px 10px",
          height: "97%",
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
          {/* Header showing hostname and match status */}
          <div
            className="popup-table-section-result"
            style={{ maxHeight: "69vh", overflowY: "auto" }}
          >
            <div
              className="popup-table"
              style={{
                marginBottom: "20px",
                backgroundColor: "#ffffff",
                borderRadius: "4px",
                padding: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h5>{comp.backend.hostname}</h5>
                <p style={{ color: comp.match ? "green" : "red", margin: 0 }}>
                  {comp.match ? "Matched" : "Unmatched"}
                </p>
              </div>
              <div className="popup-table-wrapper" style={{ overflowX: "auto" }}>
                <table
                  border={1}
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    backgroundColor: "#fff",
                  }}
                >
                  <tbody>
                    {appliedFields.map((field, index) => (
                      <tr key={index}>
                        <td
                          style={{
                            padding: "8px",
                            fontWeight: "bold",
                            backgroundColor: "#f0f8ff",
                          }}
                        >
                          {field.label}
                        </td>
                        <td style={{ padding: "8px" }}>{field.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
          {/* Header showing hostname */}

          <div
            className="popup-table-section-result"
            style={{ maxHeight: "69vh", overflowY: "auto" }}
          >
            <div
              className="popup-table"
              style={{
                marginBottom: "20px",
                backgroundColor: "#ffffff",
                borderRadius: "4px",
                padding: "10px",
              }}
            >
              <div style={{ marginBottom: "10px" }}>
                <h5>{comp.frontend.hostname}</h5>
              </div>
              <div className="popup-table-wrapper" style={{ overflowX: "auto" }}>
                <table
                  border={1}
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    backgroundColor: "#fff",
                  }}
                >
                  <tbody>
                    {configFields.map((field, index) => (
                      <tr key={index}>
                        <td
                          style={{
                            padding: "8px",
                            fontWeight: "bold",
                            backgroundColor: "#fff2e6",
                          }}
                        >
                          {field.label}
                        </td>
                        <td style={{ padding: "8px" }}>{field.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
};

export default ResultDisplay;
