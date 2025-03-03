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

  // Helper functions to build fields for each device based on the command type
  const getAppliedFields = (comp: any) => {
    switch (selectedCommand) {
      case "vlan":
        return [
          {
            label: "Interface",
            value: comp.backend.interface_config.interface,
          },
          {
            label: "Mode",
            value: comp.backend.interface_config.mode,
          },
          {
            label: "VLAN ID",
            value: comp.backend.vlan_details.vlanId,
          },
          {
            label: "VLAN Name",
            value: comp.backend.vlans ? comp.backend.vlans.vlanName : "-",
          },
          {
            label: "CIDR",
            value: comp.backend.vlan_details.cidr,
          },
        ];
      case "config_ip_router":
        return [
          { label: "Interface", value: comp.backend.interface },
          { label: "IP Address", value: comp.backend.ipaddress },
          { label: "CIDR", value: comp.backend.cidr },
        ];
      case "loopback":
        return [
          { label: "Interface", value: comp.backend.interface },
          { label: "IP Address", value: comp.backend.ipaddress },
          {
            label: "Activate Protocol",
            value: comp.backend.activateProtocol,
          },
        ];
      case "static_route":
        return [
          { label: "Prefix", value: comp.backend.prefix },
          { label: "CIDR", value: comp.backend.cidr },
          { label: "Next Hop", value: comp.backend.nexthop },
        ];
      default:
        return [];
    }
  };

  const getConfigFields = (comp: any) => {
    switch (selectedCommand) {
      case "vlan":
        return [
          {
            label: "Interface",
            value: comp.frontend.vlanDataList[0].interfaces[0].interface,
          },
          {
            label: "Mode",
            value: comp.frontend.vlanDataList[0].interfaces[0].mode,
          },
          {
            label: "VLAN ID",
            value: comp.frontend.vlanDataList[0].vlanId,
          },
          {
            label: "VLAN Name",
            value: comp.frontend.vlanDataList[0].vlanName || "-",
          },
          {
            label: "CIDR",
            value: comp.frontend.vlanDataList[0].cidr,
          },
        ];
      case "config_ip_router":
        return [
          { label: "Interface", value: comp.frontend.configIp.interface },
          { label: "IP Address", value: comp.frontend.configIp.ipAddress },
          { label: "CIDR", value: comp.frontend.configIp.cidr },
        ];
      case "loopback":
        return [
          {
            label: "Loopback Number",
            value: comp.frontend.loopbackData.loopbackNumber,
          },
          {
            label: "IP Address",
            value: comp.frontend.loopbackData.ipAddress,
          },
          {
            label: "Activate Protocol",
            value: comp.frontend.loopbackData.activateProtocol,
          },
        ];
      case "static_route":
        return [
          { label: "Prefix", value: comp.frontend.staticRouteData.prefix },
          { label: "CIDR", value: comp.frontend.staticRouteData.cidr },
          { label: "Next Hop", value: comp.frontend.staticRouteData.nextHop },
        ];
      default:
        return [];
    }
  };

  return (
    <div style={{ height: "88%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {/* Applied on device column */}
        <div
          style={{
            width: "48%",
            backgroundColor: "#e6f7ff",
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
            {resultData.comparison.map((comp: any, idx: number) => {
              const appliedFields = getAppliedFields(comp);
              return (
                <div
                  key={idx}
                  className="popup-table"
                  style={{
                    marginBottom: "20px",
                    backgroundColor: "#ffffff",
                    borderRadius: "4px",
                    padding: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <h5>{comp.backend.hostname || "-"}</h5>
                    <p style={{ color: comp.match ? "green" : "red", margin: 0 }}>
                      {comp.match ? "Matched" : "Unmatched"}
                    </p>
                  </div>
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
                            <td style={{ padding: "8px" }}>
                              {field.value ? field.value : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration sent column */}
        <div
          style={{
            width: "48%",
            backgroundColor: "#fff9e6",
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
            {resultData.comparison.map((comp: any, idx: number) => {
              const configFields = getConfigFields(comp);
              return (
                <div
                  key={idx}
                  className="popup-table"
                  style={{

                    marginBottom: "20px",
                    backgroundColor: "#ffffff",
                    borderRadius: "4px",
                    padding: "10px",
                  }}
                >
                  <div style={{ marginBottom: "10px" }}>
                    <h5>{comp.frontend.hostname || "-"}</h5>
                  </div>
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
                            <td style={{ padding: "8px" }}>
                              {field.value ? field.value : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultDisplay;
