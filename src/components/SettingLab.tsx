import React, { useState } from 'react';
import { Pencil } from "lucide-react"; // adjust the import as needed

const SettingLab = ({ lab, openModalForEdit }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div style={{ position: "relative", display: "inline-block" }}>
            <Pencil
                size={25}
                color={isHovered ? "#FFB226" : "#FFFFFF"}
                style={{
                    paddingBottom: "4px",
                    marginLeft: "10px",
                    cursor: "pointer",
                    transform: isHovered ? "scale(1.05)" : "scale(1)",
                    transition: "transform 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => openModalForEdit(lab)}
            />
            {isHovered && (
                <div
                    style={{
                        marginLeft: "5px",
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(160, 160, 160, 0.75)",
                        color: "#fff",
                        padding: "2px 5px",
                        borderRadius: "3px",
                        marginTop: "4px",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        pointerEvents: "none", // so it doesn't interfere with hover events
                    }}
                >
                    Edit Lab
                </div>
            )}
        </div>
    );
};

export default SettingLab;
