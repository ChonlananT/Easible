import React, { useState } from 'react';
import { BookCheck } from "lucide-react"; // adjust the import as needed

const CheckLab = ({ lab, handleCheckLab }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <BookCheck
        size={35}
        color={isHovered ? "rgb(55, 255, 5)" : "#FFFFFF"}
        style={{
          marginRight: "10px",
          cursor: "pointer",
          transform: isHovered ? "scale(1.03)" : "scale(1)",
          transition: "transform 0.2s ease, color 0.2s ease",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => handleCheckLab(lab)}
      />
      {isHovered && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-58%)",
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
          Check Lab
        </div>
      )}
    </div>
  );
};

export default CheckLab;
