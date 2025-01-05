import React, { useState } from 'react';
import './Bar.css';
import './RouterRouter.css';

// Reusable Field component for dropdowns and input text
const Field: React.FC<{ label: string; options?: string[]; placeholder?: string }> = ({ label, options, placeholder }) => (
  <div className="field">
    <label>{label}</label>
    {options ? (
      <select>
        {options.map((option, idx) => (
          <option key={idx} value={option.toLowerCase()}>
            {option}
          </option>
        ))}
      </select>
    ) : (
      <input type="text" placeholder={placeholder} />
    )}
  </div>
);

function RouterRouter() {
  const [boxes, setBoxes] = useState<any[]>([]); // State to hold the added boxes
  const dropdownOptions = ["Option 1", "Option 2"];
  const inputPlaceholders = ["Ex. 192.168.1.1", "Ex. 24, 25, 32"];

  const topics = {
    dropdowns: ["Host", "Port"],
    texts: ["IP address", "Subnet mask"],
  };

  const topics2 = {
    dropdowns: ["Routing Protocol"],
    texts: ["Area"],
  };

  // Add a new box (set of 3 blocks) with a unique ID
  const addBox = () => {
    const newBoxId = Date.now(); // Using current timestamp as unique ID
    setBoxes(prevBoxes => [
      ...prevBoxes,
      {
        id: newBoxId,  // Add a unique identifier for each box
        dropdownOptions: dropdownOptions,
        inputPlaceholders: inputPlaceholders,
        topics: topics,
        topics2: topics2,
      }
    ]);
  };

  // Remove the created box, ensuring you don't remove the first box
  const removeBox = (id: number) => {
    setBoxes(prevBoxes => prevBoxes.filter(box => box.id !== id)); // Filter by unique ID
  };

  return (
    <div className="App">
      {/* Navigation links */}
      <div className="nav-links-container">
      <ul className="nav-links">
        <img src="/easible-name.png" alt='' className="dashboard-icon" />
          <li className="center"><a href="/dashboard">Dashboard</a></li>
          <li className="center"><a href="/jobs">Configuration</a></li>
          <li className="center sub-topic"><a href="/routerrouter">router-router</a></li>
          <li className="center sub-topic"><a href="/routerswitch">router-switch</a></li>
          <li className="center sub-topic"><a href="/switchswitch">switch-switch</a></li>
          <li className="center sub-topic"><a href="/configdevice">config device</a></li>
          <li className="center"><a href="/hosts">Hosts</a></li>
          <li className="center"><a href="/topology">Topology</a></li>
        </ul>
      </div>
      

      <div className='content'>
          {/* Add button */}
      <div className="button-container">
        <button onClick={addBox}>Add Block</button>
      </div>

      {/* Default First Box (fixed and not removable) */}
      <div className="pair">
        {["block", "block"].map((blockClass, idx) => (
          <div key={idx} className={blockClass}>
            <div className="dropdown">
              {topics.dropdowns.map((topic, index) => (
                <Field key={index} label={topic} options={dropdownOptions} />
              ))}
            </div>
            <div className="text">
              {topics.texts.map((topic, index) => (
                <Field key={index} label={topic} placeholder={inputPlaceholders[index]} />
              ))}
            </div>
          </div>
        ))}
        <div className="single">
          <div className="single-block">
            <div className="dropdown">
              {topics2.dropdowns.map((topic, index) => (
                <Field key={index} label={topic} options={dropdownOptions} />
              ))}
            </div>
            <div className="text">
              {topics2.texts.map((topic, index) => (
                <Field key={index} label={topic} placeholder={["Ex. 0", "Ex. 0"][index]} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Render dynamically added boxes */}
      {boxes.map((box) => (
        <div className="pair" key={box.id}> {/* Use unique ID as key */}
          {["block", "block"].map((blockClass, idx) => (
            <div key={idx} className={blockClass}>
              <div className="dropdown">
                {box.topics.dropdowns.map((topic, index) => (
                  <Field key={index} label={topic} options={box.dropdownOptions} />
                ))}
              </div>
              <div className="text">
                {box.topics.texts.map((topic, index) => (
                  <Field key={index} label={topic} placeholder={box.inputPlaceholders[index]} />
                ))}
              </div>
            </div>
          ))}
          <div className="single">
            <div className="single-block">
              <div className="dropdown">
                {box.topics2.dropdowns.map((topic, index) => (
                  <Field key={index} label={topic} options={box.dropdownOptions} />
                ))}
              </div>
              <div className="text">
                {box.topics2.texts.map((topic, index) => (
                  <Field key={index} label={topic} placeholder={["Ex. 0", "Ex. 0"][index]} />
                ))}
              </div>
            </div>
          </div>
          {/* Remove button for dynamically added boxes */}
          <button onClick={() => removeBox(box.id)}>Remove Box</button>
        </div>
      ))}
      </div>

      
    </div>
  );
}

export default RouterRouter;
