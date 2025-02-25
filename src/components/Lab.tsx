import React, { useState, useEffect } from "react";
import {
  ArrowLeftFromLine,
  ChevronDown,
  CircleMinus,
  Menu,
  PlusCircle,
} from "lucide-react";
import { ArchiveX } from "lucide-react";
import "./Bar.css";
import "./Lab.css";
import "./Popup.css";
import CheckLab from "./CheckLab.tsx";
import SettingLab from "./SettingLab.tsx";
import Navbar from "./Navbar.tsx";

// ตัวเลือกของ Command ที่แสดงใน dropdown
const commandOptions = [
  "show running-config",
  "show ip interface brief",
  "show interfaces",
  "show ip route",
  "show vlan brief",
  "show interfaces trunk",
  "show spanning-tree",
  "show etherchannel summary",
];

// ตัวเลือกสำหรับ command type
const commandTypeOptions = ["all", "router", "switch"];

// Helper function สำหรับ normalize บรรทัด (ใช้สำหรับเปรียบเทียบว่าบรรทัดเหมือนกันหรือไม่)
const normalizeLine = (line) => line.split(/\s+/).join(" ").trim();

// Component สำหรับแสดงผลของ command พร้อม diff
function OutputWithDiff({ actual, expected, diff }) {
  if (diff.length === 0) {
    return (
      <div
        style={{
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          color: "green",
        }}
      >
        {actual.join("\n")}
      </div>
    );
  }
  const expectedLines = expected.split("\n");
  const maxLines = Math.max(actual.length, expectedLines.length);
  return (
    <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
      {Array.from({ length: maxLines }).map((_, i) => {
        const actLine = actual[i] || "";
        const expLine = expectedLines[i] || "";
        const diffEntry = diff.find(
          (d) => normalizeLine(d.actual) === normalizeLine(actLine)
        );

        if (diffEntry) {
          return (
            <div key={i}>
              <div style={{ color: "red" }}>{actLine}</div>
              <div
                style={{
                  color: "red",
                  fontStyle: "italic",
                  marginLeft: "20px",
                }}
              >
                Expected: {expLine}
              </div>
            </div>
          );
        } else {
          return (
            <div key={i} style={{ color: "green" }}>
              {actLine}
            </div>
          );
        }
      })}
    </div>
  );
}

function Lab() {
  // State สำหรับ Navigation และ Layout
  const [isNavOpen, setIsNavOpen] = useState(() => {
    const savedNavState = localStorage.getItem("isNavOpen");
    return savedNavState === "true";
  });
  useEffect(() => {
    localStorage.setItem("isNavOpen", isNavOpen.toString());
  }, [isNavOpen]);

  // Static labs (เดโม)
  const staticLabs = [
    {
      id: 1,
      title: "Lab 1 (Static Route)",
      content: "Details about Static Route",
    },
    { id: 2, title: "Lab 2 (RIPv2)", content: "Details about RIPv2" },
    { id: 3, title: "Lab 3 (OSPF)", content: "Details about OSPF" },
    {
      id: 4,
      title: "Lab 4 (Spanning Tree Protocol)",
      content: "Details about STP",
    },
    { id: 5, title: "Lab 5 (PTSD)", content: "Details about STP" },
  ];
  const [expanded, setExpanded] = useState(null);
  const toggleExpanded = (id) => {
    setExpanded(expanded === id ? null : id);
  };

  // State สำหรับ Navigation Dropdown
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const toggleNavDropdown = () => {
    setIsNavDropdownOpen(!isNavDropdownOpen);
  };

  // *** ส่วนของ Custom Lab (API) ***
  interface CustomLab {
    id: number;
    name: string;
    description: string;
    lab_commands: {
      command: string;
      command_type: string;
      host_expected: { hostname: string; expected_output: string }[];
    }[];
  }

  const [customLabs, setCustomLabs] = useState<CustomLab[]>([]);
  // State สำหรับ Form (ใช้ร่วมกันระหว่าง Create และ Edit)
  const [customLabForm, setCustomLabForm] = useState({
    id: null,
    name: "",
    description: "",
    lab_commands: [
      {
        command: "",
        command_type: "all",
        host_expected: [{ hostname: "", expected_output: "" }],
      },
    ],
  });

  function OutputOnlyDiff({ diff }) {
    if (!diff || diff.length === 0) {
      return (
        <div
          style={{
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            color: "green",
          }}
        >
          No differences found.
        </div>
      );
    }
  
    return (
      <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
        {diff.map((entry, idx) => (
          <div key={idx} style={{ marginBottom: "10px" }}>
            <div style={{ color: "green" }}>Actual: {entry.actual}</div>
            <div
              style={{
                color: "red",
                fontStyle: "italic",
                marginLeft: "20px",
              }}
            >
              Expected: {entry.expected}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // State เพื่อตรวจสอบว่าอยู่ในโหมดแก้ไขหรือสร้างใหม่
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState("");
  // State สำหรับ Modal (Pop-up) ของ Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State สำหรับ Check Lab Modal และผลลัพธ์การตรวจสอบ
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  interface CheckResult {
    comparison: {
      details: {
        matched: Record<string, { command: string; actual: string[] }[]>;
        unmatch: Record<
          string,
          {
            command: string;
            actual: string[];
            expected: string;
            diff: { actual: string; expected: string }[];
          }[]
        >;
      };
    };
  }
  const [checkResults, setCheckResults] = useState<CheckResult | null>(null);
  // ** NEW: loading state for Check Lab **
  const [isLoading, setIsLoading] = useState(false);

  // hostList สำหรับ dropdown ในแต่ละ command (ดึงมาจาก backend)
  interface Host {
    id: number;
    hostname: string;
    deviceType: string;
  }

  const [hostList, setHostList] = useState<Host[]>([]);

  // New state for Expected Output Popup
  const [expectedOutputPopup, setExpectedOutputPopup] = useState<{
    cmdIndex: number;
    hostIndex: number;
    value: string;
  } | null>(null);

  useEffect(() => {
    fetchCustomLabs();
  }, []);

  // ดึง custom labs จาก backend
  const fetchCustomLabs = async () => {
    try {
      const response = await fetch("/api/custom_lab");
      if (!response.ok) {
        throw new Error("Failed to fetch custom labs");
      }
      const data = await response.json();
      // Sort by your desired criteria, e.g., by an 'order' field or original index.
      data.sort((a, b) => a.order - b.order);
      setCustomLabs(data);
    } catch (error) {
      console.error(error);
    }
  };


  // ดึง host list จาก backend (ใช้ใน custom lab modal)
  const fetchHostList = async () => {
    try {
      const response = await fetch("/api/get_hosts");
      if (!response.ok) {
        throw new Error("Failed to fetch hosts");
      }
      const data = await response.json();
      setHostList(data);
    } catch (error) {
      console.error(error);
    }
  };

  // เมื่อเปิด modal สำหรับ Create หรือ Edit ให้ดึง host list มาด้วย
  const openModalForCreate = () => {
    setCustomLabForm({
      id: null,
      name: "",
      description: "",
      lab_commands: [
        {
          command: "",
          command_type: "all",
          host_expected: [{ hostname: "", expected_output: "" }],
        },
      ],
    });
    setIsEditing(false);
    setFormError("");
    fetchHostList();
    setIsModalOpen(true);
  };

  const openModalForEdit = (lab) => {
    setCustomLabForm({
      id: lab.id,
      name: lab.name,
      description: lab.description,
      lab_commands: lab.lab_commands.map((cmd) => ({
        command: cmd.command,
        command_type: cmd.device_type || "all",
        host_expected:
          cmd.host_expected && cmd.host_expected.length > 0
            ? cmd.host_expected
            : [{ hostname: "", expected_output: "" }],
      })),
    });
    setIsEditing(true);
    setFormError("");
    fetchHostList();
    setIsModalOpen(true);
  };

  // Handle changes สำหรับ Lab Name และ Description
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setCustomLabForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handle changes สำหรับแต่ละ command
  const handleCommandChange = (index, field, value) => {
    const updatedCommands = [...customLabForm.lab_commands];
    updatedCommands[index][field] = value;
    setCustomLabForm((prev) => ({ ...prev, lab_commands: updatedCommands }));
  };

  // เพิ่ม command row ใหม่
  const addCommand = () => {
    setCustomLabForm((prev) => ({
      ...prev,
      lab_commands: [
        ...prev.lab_commands,
        {
          command: "",
          command_type: "all",
          host_expected: [{ hostname: "", expected_output: "" }],
        },
      ],
    }));
  };

  // ลบ command row (อย่างน้อยให้เหลือ 1)
  const removeCommand = (index) => {
    if (customLabForm.lab_commands.length === 1) return;
    const updatedCommands = customLabForm.lab_commands.filter(
      (_, idx) => idx !== index
    );
    setCustomLabForm((prev) => ({ ...prev, lab_commands: updatedCommands }));
  };

  // จัดการกับ expected output ของแต่ละ host ใน command
  const handleHostExpectedChange = (cmdIndex, hostIndex, field, value) => {
    const updatedCommands = [...customLabForm.lab_commands];
    updatedCommands[cmdIndex].host_expected[hostIndex][field] = value;
    setCustomLabForm((prev) => ({ ...prev, lab_commands: updatedCommands }));
  };

  // เพิ่ม host row ให้กับ command ที่เลือก
  const addHostExpected = (cmdIndex) => {
    const updatedCommands = [...customLabForm.lab_commands];
    updatedCommands[cmdIndex].host_expected.push({
      hostname: "",
      expected_output: "",
    });
    setCustomLabForm((prev) => ({ ...prev, lab_commands: updatedCommands }));
  };

  // ลบ host row ใน command ที่เลือก
  const removeHostExpected = (cmdIndex, hostIndex) => {
    const updatedCommands = [...customLabForm.lab_commands];
    if (updatedCommands[cmdIndex].host_expected.length === 1) return;
    updatedCommands[cmdIndex].host_expected = updatedCommands[
      cmdIndex
    ].host_expected.filter((_, idx) => idx !== hostIndex);
    setCustomLabForm((prev) => ({ ...prev, lab_commands: updatedCommands }));
  };

  // ตรวจสอบ duplicate commands
  const hasDuplicateCommands = () => {
    const commands = customLabForm.lab_commands
      .map((cmd) => cmd.command.trim())
      .filter((cmd) => cmd !== "");
    return commands.length !== new Set(commands).size;
  };

  // ส่งข้อมูล Custom Lab (Create หรือ Update)
  const handleCustomLabSubmit = async (e) => {
    e.preventDefault();
    if (!customLabForm.name.trim()) {
      setFormError("Lab name is required.");
      return;
    }
    if (hasDuplicateCommands()) {
      setFormError("Duplicate commands are not allowed.");
      return;
    }

    const lab_commands = customLabForm.lab_commands.map((cmd, idx) => ({
      command: cmd.command,
      command_order: idx + 1,
      command_type: cmd.command_type,
      host_expected: cmd.host_expected,
    }));

    const payload = {
      name: customLabForm.name,
      description: customLabForm.description,
      lab_commands,
    };

    try {
      let response;
      if (isEditing && customLabForm.id) {
        response = await fetch(`/api/custom_lab/${customLabForm.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/custom_lab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save custom lab");
      }
      setCustomLabForm({
        id: null,
        name: "",
        description: "",
        lab_commands: [
          {
            command: "",
            command_type: "all",
            host_expected: [{ hostname: "", expected_output: "" }],
          },
        ],
      });
      setIsEditing(false);
      setFormError("");
      setIsModalOpen(false);
      fetchCustomLabs();
    } catch (error) {
      setFormError(error.message);
    }
  };

  // ฟังก์ชันสำหรับ Check Lab with loading state
  const handleCheckLab = async (lab) => {
    // Open the modal and start loading immediately
    setIsCheckModalOpen(true);
    setIsLoading(true);
    try {
      const payload = {
        lab_id: lab.id,
        lab_commands: lab.lab_commands,
      };
      const response = await fetch(`/api/custom_lab/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to check lab");
      }
      const result = await response.json();
      setCheckResults(result);
    } catch (error) {
      console.error("Error checking lab:", error);
      alert("เกิดข้อผิดพลาดในการตรวจสอบ Lab");
    } finally {
      setIsLoading(false);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const handleDeleteLab = async () => {
    try {
      console.log("Lab ID to delete:", customLabForm.id);
      const url = `/api/custom_lab/${customLabForm.id}`;
      console.log("Deleting lab at URL:", url);

      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete Lab";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = await response.text();
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      await fetchCustomLabs();
      setIsDeleteModalOpen(false);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error deleting lab:", error);
      alert("เกิดข้อผิดพลาดในการลบ Lab: " + error.message);
    }
  };

  return (
    <div className="App">
      {/* Navigation Side Bar */}
      <Navbar isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} />
      {/* Main Content */}
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
          Lab check
        </div>

        {/* Custom Labs Header พร้อมปุ่มสำหรับ "Create Custom Lab" */}
        <div className="container-lab">
          <div className="header-lab">
            <h3 className="title-lab">Custom Labs</h3>
            <div className="buttonContainer-lab">
              <button onClick={openModalForCreate} className="addButton-lab">
                <PlusCircle size={20} className="icon-lab" style={{ marginRight: "8px" }} />
                Create new lab
              </button>
            </div>
          </div>
          {customLabs.length === 0 ? (
            <p className="noLabs-lab">No custom labs available.</p>
          ) : (
            <ul className="labList-lab">
              {customLabs.map((lab) => (
                <li key={lab.id} className="labItem-lab">
                  <div className="labInfo-lab">
                    <strong className="labName-lab">{lab.name}</strong>
                    <span className="labDescription-lab">
                      {lab.description}
                    </span>
                    <SettingLab lab={lab} openModalForEdit={openModalForEdit} />
                  </div>
                  <div className="labActions-lab">
                    <CheckLab lab={lab} handleCheckLab={handleCheckLab} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modal สำหรับ Create / Edit Custom Lab */}
        {isModalOpen && (
          <div className="popup-overlay">
            <div className="popup-content-lab">
              <h2>{isEditing ? "Edit Lab" : "Create Lab"}</h2>
              {formError && <p style={{ color: "red" }}>{formError}</p>}
              <form onSubmit={handleCustomLabSubmit}>
                {/* name */}
                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      fontWeight: "bold",
                      marginRight: "10px",
                      display: "inline-block",
                      width: "100px",
                    }}
                  >
                    Lab Name:
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={customLabForm.name}
                    onChange={handleFormChange}
                    required
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      width: "calc(100% - 120px)",
                    }}
                  />
                </div>
                {/* description */}
                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      fontWeight: "bold",
                      marginRight: "10px",
                      display: "inline-block",
                      width: "100px",
                    }}
                  >
                    Description:
                  </label>
                  <textarea
                    name="description"
                    value={customLabForm.description}
                    onChange={handleFormChange}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      width: "calc(100% - 120px)",
                      height: "40px",
                      minHeight: "40px",
                      verticalAlign: "top",
                    }}
                  />
                </div>
                {/* command */}
                <div className="commands-wrapper">
                  <label
                    style={{
                      fontWeight: "bold",
                      marginRight: "10px",
                      display: "inline-block",
                      verticalAlign: "top",
                      width: "100px",
                    }}
                  >
                    Commands:
                  </label>
                  <div className="command-add-lab">
                    {customLabForm.lab_commands.map((cmd, index) => (
                      <div
                        key={index}
                        style={{
                          marginBottom: "10px",
                          border: "1px solid #ccc",
                          padding: "15px 18px",
                          borderRadius: "6px",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1, 0.15)",
                        }}
                      >
                        <div className="dropdown-lab">
                          <div>
                            <strong>Select command:</strong>
                            <select
                              className="dropdown-select-lab"
                              value={cmd.command}
                              onChange={(e) =>
                                handleCommandChange(
                                  index,
                                  "command",
                                  e.target.value
                                )
                              }
                              required
                              style={{ width: "60%", marginLeft: "10px" }}
                            >
                              <option value="">Select command</option>
                              {commandOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>
                          {customLabForm.lab_commands.length > 1 && (
                            <ArchiveX
                              className="archive-x"
                              style={{ marginTop: "5px" }}
                              onClick={() => removeCommand(index)}
                            />
                          )}
                        </div>
                        <div style={{ marginTop: "10px" }}>
                          <strong>Select device:</strong>
                          <button
                            className="add-device-lab"
                            type="button"
                            onClick={() => addHostExpected(index)}
                          >
                            + Add Device
                          </button>

                          {(cmd.host_expected || []).map((hostExp, hIndex) => (
                            <div
                              key={hIndex}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginTop: "5px",
                              }}
                            >
                              <select
                                className="dropdown-select-lab"
                                value={hostExp.hostname}
                                onChange={(e) =>
                                  handleHostExpectedChange(
                                    index,
                                    hIndex,
                                    "hostname",
                                    e.target.value
                                  )
                                }
                                style={{ width: "40%" }}
                                required
                              >
                                <option value="">Select device</option>
                                {[...hostList]
                                  .sort((a, b) =>
                                    a.hostname.localeCompare(b.hostname)
                                  )
                                  .map((h) => (
                                    <option key={h.id} value={h.hostname}>
                                      {h.hostname}
                                    </option>
                                  ))}
                              </select>

                              {/* Replace the textarea with a button */}
                              <button
                                className="edit-btn-lab"
                                type="button"
                                onClick={() =>
                                  setExpectedOutputPopup({
                                    cmdIndex: index,
                                    hostIndex: hIndex,
                                    value: hostExp.expected_output,
                                  })
                                }
                              >
                                Edit Expected Output
                              </button>
                              <div style={{ fontStyle: "italic", color: "grey", fontSize: "12px" }}>*required</div>
                              {cmd.host_expected.length > 1 && (
                                <CircleMinus
                                  onClick={() =>
                                    removeHostExpected(index, hIndex)
                                  }
                                  color="red"
                                  cursor={"pointer"}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div style={{ justifyContent: "center", display: "flex" }}>
                      <button
                        className="add-btn-lab"
                        type="button"
                        onClick={addCommand}
                      >
                        + Add Command
                      </button>
                    </div>
                  </div>
                </div>

                {/* button */}
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    {isEditing && (
                      <button
                        type="button" // Prevents form submission
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="delete-btn-lab"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div>
                    <button
                      className="cancel-btn-lab"
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="green-round-lab"
                      type="submit"
                      style={{ marginLeft: "10px" }}
                    >
                      {isEditing ? "Update" : "Create"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Popup Modal สำหรับแก้ไข Expected Output */}
        {expectedOutputPopup && (
          <div className="popup-overlay">
            <div className="popup-content-lab">
              <h2>Edit Expected Output</h2>
              <textarea
                value={expectedOutputPopup.value}
                onChange={(e) =>
                  setExpectedOutputPopup({
                    ...expectedOutputPopup,
                    value: e.target.value,
                  })
                }
                style={{
                  padding: "10px",
                  width: "100%",
                  height: "500px",
                  marginTop: "10px",
                }}
                placeholder="Expected output.."
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  className="cancel-btn-lab"
                  onClick={() => setExpectedOutputPopup(null)}
                >
                  Cancel
                </button>
                <button
                  className="green-round-lab"
                  onClick={() => {
                    // Save the updated expected output
                    handleHostExpectedChange(
                      expectedOutputPopup.cmdIndex,
                      expectedOutputPopup.hostIndex,
                      "expected_output",
                      expectedOutputPopup.value
                    );
                    setExpectedOutputPopup(null);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal สำหรับ Check Lab Result */}
        {isCheckModalOpen && (
          <div className="popup-overlay">
            <div className="popup-content-lab">
              <h2>Check Lab Result</h2>
              {isLoading ? (
                <div className="loading-container">
                  <div className="spinner-lab" />
                  <p>Loading...</p>
                </div>
              ) : checkResults ? (
                <div>
                  {Object.keys(checkResults.comparison.details.unmatch).length > 0 ? (
                      <div>
                        <h3 style={{ color: "red" }}>Unmatched</h3>
                        {Object.entries(
                          checkResults.comparison.details.unmatch
                        ).map(([hostname, details]) => (
                          <div key={hostname}>
                            <h4>{hostname}</h4>
                            {details.map((item, idx) => (
                              <div key={idx} style={{ marginBottom: "15px" }}>
                                <p>
                                  <strong>Command:</strong> {item.command}
                                </p>
                                <OutputOnlyDiff diff={item.diff} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ):(
                      <p>💩</p>
                    )}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setIsCheckModalOpen(false)}
                      className="cancel-btn-lab"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <p>No results available.</p>
              )}
            </div>
          </div>
        )}

        {isDeleteModalOpen && (
          <div className="popup-overlay">
            <div className="popup-content">
              <h2>Confirm Delete</h2>
              <div>Are you sure you want to delete this Lab </div>
              <div style={{ color: "red" }}>
                "{customLabForm.name}"
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  className="cancel-btn-lab"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  Cancel
                </button>
                <button className="green-round-lab" onClick={handleDeleteLab}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Lab;
