import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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
    <BrowserRouter>
      <App />
    </BrowserRouter>
  // </React.StrictMode>
);

reportWebVitals(console.log);
