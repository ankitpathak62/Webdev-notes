import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import Room from "./Pages/Room";

function App() {
  return (
    <>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
