import React, { useState, useEffect } from "react";
import {
  ArrowLeftFromLine,
  ChevronDown,
  ChevronRight,
  Menu,
  PlusCircle,
} from "lucide-react";
import { ArchiveX } from "lucide-react";
import { motion } from "framer-motion";
import "./Bar.css";
import "./Topology.css";

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
  // ถ้า diff เป็น array ว่าง (หมายถึง matched) ให้แสดง actual ทั้งหมดเป็นสีเขียว
  if (diff.length === 0) {
    return (
      <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", color: "green" }}>
        {actual.join("\n")}
      </div>
    );
  }
  // ถ้ามี diff ให้ทำการแสดงผลแบบบรรทัดต่อบรรทัด
  const expectedLines = expected.split("\n");
  const maxLines = Math.max(actual.length, expectedLines.length);
  return (
    <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
      {Array.from({ length: maxLines }).map((_, i) => {
        const actLine = actual[i] || "";
        const expLine = expectedLines[i] || "";
        // ค้นหา entry ใน diff ที่ตรงกับบรรทัด actual นี้ (โดย normalize)
        const diffEntry = diff.find(
          (d) => normalizeLine(d.actual) === normalizeLine(actLine)
        );

        if (diffEntry) {
          return (
            <div key={i}>
              {/* actual ที่ผิด แสดงเป็นสีแดง */}
              <div style={{ color: "red" }}>{actLine}</div>
              {/* แสดง expected (diff.expected) ด้านล่าง */}
              <div style={{ color: "red", fontStyle: "italic", marginLeft: "20px" }}>
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
    { id: 1, title: "Lab 1 (Static Route)", content: "Details about Static Route" },
    { id: 2, title: "Lab 2 (RIPv2)", content: "Details about RIPv2" },
    { id: 3, title: "Lab 3 (OSPF)", content: "Details about OSPF" },
    { id: 4, title: "Lab 4 (Spanning Tree Protocol)", content: "Details about STP" },
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
  const [customLabs, setCustomLabs] = useState([]);
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
  // State เพื่อตรวจสอบว่าอยู่ในโหมดแก้ไขหรือสร้างใหม่
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState("");
  // State สำหรับ Modal (Pop-up) ของ Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State สำหรับ Check Lab Modal และผลลัพธ์การตรวจสอบ
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [checkResults, setCheckResults] = useState(null);

  // hostList สำหรับ dropdown ในแต่ละ command (ดึงมาจาก backend)
  const [hostList, setHostList] = useState([]);

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
    updatedCommands[cmdIndex].host_expected.push({ hostname: "", expected_output: "" });
    setCustomLabForm((prev) => ({ ...prev, lab_commands: updatedCommands }));
  };

  // ลบ host row ใน command ที่เลือก
  const removeHostExpected = (cmdIndex, hostIndex) => {
    const updatedCommands = [...customLabForm.lab_commands];
    if (updatedCommands[cmdIndex].host_expected.length === 1) return;
    updatedCommands[cmdIndex].host_expected = updatedCommands[cmdIndex].host_expected.filter(
      (_, idx) => idx !== hostIndex
    );
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
          { command: "", command_type: "all", host_expected: [{ hostname: "", expected_output: "" }] },
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

  // ฟังก์ชันสำหรับ Check Lab
  const handleCheckLab = async (lab) => {
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
      setIsCheckModalOpen(true);
    } catch (error) {
      console.error("Error checking lab:", error);
      alert("เกิดข้อผิดพลาดในการตรวจสอบ Lab");
    }
  };

  return (
    <div className="App">
      {/* Navigation Side Bar */}
      <div className={`nav-links-container ${isNavOpen ? "" : "closed"}`}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            paddingRight: "10px",
            paddingTop: "10px",
          }}
        >
          <button
            style={{
              marginBottom: "16px",
              padding: "8px",
              color: "#7b7b7b",
              borderRadius: "8px",
              zIndex: 50,
              border: "none",
              background: "#f5f7f9",
            }}
            onClick={() => setIsNavOpen(false)}
          >
            <ArrowLeftFromLine size={24} />
          </button>
          <img src="/easible-name.png" alt="" className="dashboard-icon" />
        </div>
        <ul className="nav-links">
          <li className="center">
            <a href="/dashboard">Dashboard</a>
          </li>
          <li className="center">
            <a href="/hosts">Devices</a>
          </li>
          <li
            className="center"
            onClick={toggleNavDropdown}
            style={{ cursor: "pointer", color: "black" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#8c94dc")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "black")}
          >
            <a>Configuration</a>
            <ChevronDown className={isNavDropdownOpen ? "chevron-nav rotated" : "chevron-nav"} />
          </li>
          <ul className={`nav-dropdown ${isNavDropdownOpen ? "open" : ""}`}>
            <li className="center sub-topic">
              <a href="/routerrouter">router-router</a>
            </li>
            <li className="center sub-topic">
              <a href="/routerswitch">router-switch</a>
            </li>
            <li className="center sub-topic">
              <a href="/switchswitch">switch-switch</a>
            </li>
            <li className="center sub-topic">
              <a href="/switchhost">switch-host</a>
            </li>
            <li className="center sub-topic">
              <a href="/configdevice">config device</a>
            </li>
          </ul>
          <li className="center">
            <a href="/lab" style={{ color: "#8c94dc" }}>
              Lab Check
            </a>
          </li>
        </ul>
      </div>

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
        <div
          style={{
            padding: "20px",
            border: "1px solid #ddd",
            marginBottom: "20px",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3>Custom Labs</h3>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={openModalForCreate}
                style={{
                  background: "none",
                  border: "1px solid #ccc",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                <PlusCircle size={20} style={{ marginRight: "5px" }} />
                Add Lab
              </button>
            </div>
          </div>
          {customLabs.length === 0 ? (
            <p>No custom labs available.</p>
          ) : (
            <ul>
              {customLabs.map((lab) => (
                <li key={lab.id} style={{ marginBottom: "10px" }}>
                  <strong>{lab.name}</strong> - {lab.description}
                  <button onClick={() => openModalForEdit(lab)} style={{ marginLeft: "10px" }}>
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("คุณต้องการลบ Lab นี้หรือไม่?"))
                        fetch(`/api/custom_lab/${lab.id}`, { method: "DELETE" })
                          .then((res) => {
                            if (!res.ok) throw new Error("ไม่สามารถลบ Lab ได้");
                            fetchCustomLabs();
                          })
                          .catch((err) => {
                            console.error("Error deleting lab:", err);
                            alert("เกิดข้อผิดพลาดในการลบ Lab");
                          });
                    }}
                    style={{ marginLeft: "10px" }}
                  >
                    Delete
                  </button>
                  <button onClick={() => handleCheckLab(lab)} style={{ marginLeft: "10px" }}>
                    Check Lab
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modal สำหรับ Create / Edit Custom Lab */}
        {isModalOpen && (
          <div
            className="modal-overlay"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              className="modal-content"
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "8px",
                width: "700px",
                maxHeight: "80vh",
                overflowY: "auto",
              }}
            >
              <h2>{isEditing ? "Edit Custom Lab" : "Create Custom Lab"}</h2>
              {formError && <p style={{ color: "red" }}>{formError}</p>}
              <form onSubmit={handleCustomLabSubmit}>
                <div style={{ marginBottom: "10px" }}>
                  <label>Lab Name:</label>
                  <input
                    type="text"
                    name="name"
                    value={customLabForm.name}
                    onChange={handleFormChange}
                    required
                    style={{ marginLeft: "10px" }}
                  />
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label>Description:</label>
                  <textarea
                    name="description"
                    value={customLabForm.description}
                    onChange={handleFormChange}
                    style={{ marginLeft: "10px", verticalAlign: "top" }}
                  />
                </div>
                <div>
                  <label>Commands:</label>
                  {customLabForm.lab_commands.map((cmd, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: "10px",
                        border: "1px solid #ccc",
                        padding: "10px",
                        borderRadius: "6px",
                      }}
                    >
                      <div className="dropdown-lab">
                        <select
                          className="dropdown-select-lab"
                          value={cmd.command}
                          onChange={(e) => handleCommandChange(index, "command", e.target.value)}
                          required
                          style={{ width: "40%", marginRight: "10px" }}
                        >
                          <option value="">Select command</option>
                          {commandOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <select
                          value={cmd.command_type}
                          onChange={(e) => handleCommandChange(index, "command_type", e.target.value)}
                          style={{ width: "20%", marginRight: "10px" }}
                        >
                          {commandTypeOptions.map((typeOption) => (
                            <option key={typeOption} value={typeOption}>
                              {typeOption}
                            </option>
                          ))}
                        </select>
                        {customLabForm.lab_commands.length > 1 && (
                          <ArchiveX className="archive-x" onClick={() => removeCommand(index)} />
                        )}
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        <strong>Hosts for this command:</strong>
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
                              value={hostExp.hostname}
                              onChange={(e) =>
                                handleHostExpectedChange(index, hIndex, "hostname", e.target.value)
                              }
                              style={{ width: "40%" }}
                              required
                            >
                              <option value="">Select host</option>
                              {hostList
                                .filter((h) =>
                                  cmd.command_type === "all" ? true : h.deviceType === cmd.command_type
                                )
                                .map((h) => (
                                  <option key={h.id} value={h.hostname}>
                                    {h.hostname}
                                  </option>
                                ))}
                            </select>
                            <textarea
                              placeholder="Expected output"
                              value={hostExp.expected_output}
                              onChange={(e) =>
                                handleHostExpectedChange(index, hIndex, "expected_output", e.target.value)
                              }
                              style={{ width: "40%" }}
                            />
                            {cmd.host_expected.length > 1 && (
                              <button type="button" onClick={() => removeHostExpected(index, hIndex)}>
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => addHostExpected(index)}>
                          Add Host
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addCommand}>
                    Add Command
                  </button>
                </div>
                <div style={{ marginTop: "10px" }}>
                  <button className="green-round-lab" type="submit">
                    {isEditing ? "Update Custom Lab" : "Create Custom Lab"}
                  </button>
                  <button
                    className="cancel-btn"
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{ marginLeft: "10px" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal สำหรับ Check Lab Result */}
        {isCheckModalOpen && (
          <div
            className="modal-overlay"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1100,
            }}
          >
            <div
              className="modal-content"
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "8px",
                width: "600px",
                maxHeight: "80vh",
                overflowY: "auto",
              }}
            >
              <h2>Check Lab Result</h2>
              {checkResults ? (
                <div>
                  {Object.keys(checkResults.comparison.details.matched).length > 0 && (
                    <div>
                      <h3 style={{ color: "green" }}>Matched</h3>
                      {Object.entries(checkResults.comparison.details.matched).map(([hostname, details]) => (
                        <div key={hostname}>
                          <h4>{hostname}</h4>
                          {details.map((item, idx) => (
                            <div key={idx} style={{ marginBottom: "15px" }}>
                              <p>
                                <strong>Command:</strong> {item.command}
                              </p>
                              <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", color: "green" }}>
                                {item.actual.join("\n")}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(checkResults.comparison.details.unmatch).length > 0 && (
                    <div>
                      <h3 style={{ color: "red" }}>Unmatched</h3>
                      {Object.entries(checkResults.comparison.details.unmatch).map(([hostname, details]) => (
                        <div key={hostname}>
                          <h4>{hostname}</h4>
                          {details.map((item, idx) => (
                            <div key={idx} style={{ marginBottom: "15px" }}>
                              <p>
                                <strong>Command:</strong> {item.command}
                              </p>
                              <OutputWithDiff
                                actual={item.actual}
                                expected={item.expected}
                                diff={item.diff}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setIsCheckModalOpen(false)} style={{ marginTop: "10px" }}>
                    Close
                  </button>
                </div>
              ) : (
                <p>No results available.</p>
              )}
            </div>
          </div>
        )}

        {/* Static Labs Section (สำหรับเดโม) */}
        <div className="content-board-lab">
          <div className="lab-topic">Choose lab</div>
          <div className="lab-board-container">
            <div className="lab-board">
              {staticLabs.map((lab) => (
                <div key={lab.id} style={{ marginBottom: "10px" }}>
                  <div className="lab-item">
                    <div
                      style={{
                        width: "100%",
                        cursor: "pointer",
                        fontSize: "20px",
                        fontWeight: "450",
                      }}
                      onClick={() => toggleExpanded(lab.id)}
                    >
                      {lab.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "50px" }}>
                      <div className="host-name-lab">
                        Host 1:
                        <div className="dropdown-lab">
                          <select className="dropdown-select-lab" value="" onChange={() => {}}>
                            <option value="option1">Option 1</option>
                            <option value="option2">Option 2</option>
                            <option value="option3">Option 3</option>
                          </select>
                        </div>
                      </div>
                      <div className="host-name-lab">
                        Host 2:
                        <div className="dropdown-lab">
                          <select className="dropdown-select-lab" value="" onChange={() => {}}>
                            <option value="option1">Option 1</option>
                            <option value="option2">Option 2</option>
                            <option value="option3">Option 3</option>
                          </select>
                        </div>
                      </div>
                      <div
                        style={{ width: "100%", height: "100%", cursor: "pointer" }}
                        onClick={() => toggleExpanded(lab.id)}
                      >
                        {expanded === lab.id ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
                      </div>
                    </div>
                  </div>

                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={expanded === lab.id ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    {expanded === lab.id && (
                      <div className="lab-content">
                        <p>{lab.content}</p>
                        <div style={{ display: "flex", justifyContent: "flex-end", margin: "5px" }}>
                          <button className="green-round-lab" onClick={() => handleCheckLab(lab)}>
                            Check Lab
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* End Static Labs */}
      </div>
    </div>
  );
}

export default Lab;
