import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx'; // Ensure App.tsx exists in src
import reportWebVitals from './reportWebVitals.ts'; // Ensure reportWebVitals.ts exists in src

const container = document.getElementById('root');

if (!container) {
  throw new Error("Root container not found");
}

const root = ReactDOM.createRoot(container);
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log); // Pass console.log to log performance entries

