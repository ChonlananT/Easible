// Spinner.tsx
import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const Spinner: React.FC<{ color?: string; size?: string }> = ({
  color = "primary",
  size = "",
}) => {
  const sizeClass =
    size === "small"
      ? "spinner-border-sm"
      : size === "large"
      ? "spinner-border-lg"
      : "";

  return (
    <div className={`d-flex justify-content-center`}>
      <div
        className={`spinner-border text-${color} ${sizeClass}`}
        role="status"
      >
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
};

export default Spinner;
