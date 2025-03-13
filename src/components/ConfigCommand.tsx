import React, { useState, useEffect } from "react";
import "./RouterSwitch.css";
import "./Lab.css";
import "./Bar.css";
import "./SwitchSwitch.css";
import Spinner from "./bootstrapSpinner.tsx";
import { Menu, RefreshCcw, CircleMinus } from "lucide-react";
import Navbar from "./Navbar.tsx";
import "./Popup.css";

type DropdownOption = {
   hostname: string;
   deviceType: string; // to help distinguish device types if needed
};

type CommandLink = {
   device: string;
   commandText: string;
};

function ConfigCommand() {
   const [hosts, setHosts] = useState<DropdownOption[]>([]);
   const [loading, setLoading] = useState<boolean>(true);
   const [error, setError] = useState("");

   // Each command link lets the user choose one device and enter commands
   const [commandLinks, setCommandLinks] = useState<CommandLink[]>([
      { device: "", commandText: "" },
   ]);

   const [commandResult, setCommandResult] = useState<any>(null);
   const [showResultPopup, setShowResultPopup] = useState(false);
   const [commandLoading, setCommandLoading] = useState(false);

   const [isNavOpen, setIsNavOpen] = useState(() => {
      const savedNavState = localStorage.getItem("isNavOpen");
      return savedNavState === "true";
   });
   useEffect(() => {
      localStorage.setItem("isNavOpen", isNavOpen.toString());
   }, [isNavOpen]);

   // Fetch hosts from backend; fetching status (spinner) is preserved
   const fetchHosts = () => {
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
            // Assuming data.parsed_result is an array of host objects
            setHosts(data.parsed_result);
         })
         .catch((err) => setError(err.message))
         .finally(() => setLoading(false));
   };

   useEffect(() => {
      fetchHosts();
   }, []);

   // Update a command link's field
   const handleLinkChange = (
      index: number,
      field: "device" | "commandText",
      value: string
   ) => {
      setCommandLinks((prevLinks) => {
         const newLinks = [...prevLinks];
         newLinks[index] = { ...newLinks[index], [field]: value };
         return newLinks;
      });
   };

   // Add a new link row
   const handleAddLink = () => {
      setCommandLinks((prevLinks) => [...prevLinks, { device: "", commandText: "" }]);
   };

   // Remove an existing link row (if more than one)
   const handleRemoveLink = (index: number) => {
      setCommandLinks((prevLinks) => prevLinks.filter((_, i) => i !== index));
   };

   // Send commands to the selected devices
   const handleSendCommand = () => {
      setError("");
      // Validate each link: device must be selected and commandText must not be empty.
      for (const link of commandLinks) {
         if (!link.device || link.commandText.trim() === "") {
            setError("Please select a device and enter commands for all links.");
            return;
         }
      }
      // Prepare payload: for each link, split the command text by newline into an array.
      const payload = commandLinks.map((link) => ({
         device: link.device,
         commands: link.commandText
            .split("\n")
            .map((cmd) => cmd.trim())
            .filter((cmd) => cmd !== ""),
      }));
      setCommandLoading(true);
      fetch("/api/send_command", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
      })
         .then((res) => res.json())
         .then((data) => {
            if (data.error) {
               setError(data.error);
            } else {
               setCommandResult(data.result);
               setShowResultPopup(true);
            }
         })
         .catch((err) => setError(err.message))
         .finally(() => setCommandLoading(false));
   };

   return (
      <div className="App">
         <Navbar isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} />
         <div className={`content ${isNavOpen ? "expanded" : "full-width"}`}>
            {/* Header */}
            <div
               className="content-topic"
               style={{ display: "flex", justifyContent: "space-between" }}
            >
               <div>
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
                  Custom Command
               </div>
               <button
                  onClick={fetchHosts}
                  style={{
                     display: "flex",
                     fontSize: "16px",
                     gap: "10px",
                     alignItems: "center",
                     paddingRight: "50px",
                     paddingTop: "20px",
                     border: "none",
                     background: "none",
                     cursor: loading ? "not-allowed" : "pointer",
                  }}
                  disabled={loading}
                  className="button-refresh"
               >
                  <RefreshCcw /> Refresh
               </button>
            </div>

            {/* Main Content */}
            <div className="content-board">
               {!loading && (
                  <div className="all-links">
                     {commandLinks.map((link, index) => (
                        <div key={index} className="switch-switch">
                           <div className="top-link">
                              <div className="link-index">Device {index + 1}</div>
                              <div className="remove-link-container">
                                 {commandLinks.length > 1 && (
                                    <button
                                       onClick={() => handleRemoveLink(index)}
                                       className="button-sw-sw-remove"
                                    >
                                       <CircleMinus size={20} color="red" />
                                    </button>
                                 )}
                              </div>
                           </div>
                           <div className="content-section">
                              <div className="host-selection-container">
                                 <div className="host-selection__hosts">
                                    <div className="host-card">
                                       <div className="host-selection__dropdown-group">
                                          <label>Device:</label>
                                          <div className="host-selection__dropdown-container">
                                             <select
                                                className="host-selection__dropdown"
                                                value={link.device}
                                                onChange={(e) =>
                                                   handleLinkChange(index, "device", e.target.value)
                                                }
                                             >
                                                <option value="">-- Select a Device --</option>
                                                {hosts.map((host) => (
                                                   <option key={host.hostname} value={host.hostname}>
                                                      {host.hostname} {host.deviceType && `(${host.deviceType})`}
                                                   </option>
                                                ))}
                                             </select>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                              <div style={{ marginTop: "15px", marginLeft: "auto", marginRight: "auto" }}>
                                 <div
                                    className="host-card"
                                    style={{
                                       width: "500px",
                                       backgroundColor: "#e0f7fa",
                                       marginTop: "15px",
                                       borderColor: "#aad3f0",
                                    }}
                                 >
                                    <label>Enter Commands:</label>
                                    <textarea
                                       className="command-textarea"
                                       value={link.commandText}
                                       onChange={(e) =>
                                          handleLinkChange(index, "commandText", e.target.value)
                                       }
                                       placeholder={`Write your commands here, one per line.
e.g.:
show ip route
show running-config`}
                                       rows={4}
                                       style={{
                                          width: "100%",
                                          padding: "8px",
                                          marginTop: "5px",
                                          borderRadius: "12px",
                                       }}
                                    />
                                 </div>


                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
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
                        "+ Add Device"
                     )}
                  </button>
                  <div className="line"></div>
               </div>
            </div>

            {/* Send Button placed outside the content board */}
            <div
               className="submit-sw-sw-container"
               style={{ marginTop: "20px", textAlign: "center" }}
            >
               <button
                  className="button-sw-sw-submit"
                  onClick={handleSendCommand}
                  disabled={commandLoading}
                  style={{ fontSize: "16px", cursor: "pointer" }}
               >
                  {commandLoading ? <Spinner color="white" size="small" /> : "Send"}
               </button>
            </div>
         </div>

         {/* Command Result Popup */}
         {showResultPopup && (
            <div className="popup-overlay">
               <div
                  className="popup-content"
                  style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}
               >
                  <h2>Command Result</h2>
                  <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
                     {JSON.stringify(commandResult, null, 2)}
                  </pre>
                  <div style={{ textAlign: "right", marginTop: "15px" }}>
                     <button
                        onClick={() => setShowResultPopup(false)}
                        style={{ padding: "8px 16px" }}
                     >
                        Close
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Error Popup */}
         {error && (
            <div className="popup-overlay">
               <div
                  className="popup-content-host">
                  <div className="error-rt-rt">{error}</div>
                  <button
                     className="cancel-btn"
                     onClick={() => {
                        setError("");
                     }}
                  >
                     close
                  </button>
               </div>
            </div>
         )}
      </div>
   );
}

export default ConfigCommand;
