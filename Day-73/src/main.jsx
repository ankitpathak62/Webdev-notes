import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; 
import Counter from "../context/Counter.jsx"; // Corrected the path

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Counter>
      <App />
    </Counter>
  </React.StrictMode>
);
