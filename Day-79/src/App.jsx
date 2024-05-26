import React from "react";
import Navbar from "./components/Navbar";
import Project from "./components/Project"; // Corrected the import statement
import Experience from "./components/Experience";
import Hero from "./components/Hero";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

const App = () => {
  return (
    <Router>
      <div>
        <nav className="   mb-20 flex items-center justify-between py-6">
          <div className="  flex flex-shrink-0 items-center text-4xl">
            <Link to="RB" className="mx-2 w-10">RB</Link>
          </div>
          <div
            className="m-8 flex items-center justify-center gap-4 text-2xl
         "
          >
            <Link to="Experience">Experience</Link>
            <Link to="Project">Project</Link>
          </div>
        </nav>

        <Routes>
          <Route path="/Experience" element={<Experience />} />
          <Route path="/RB" element={<Hero />} />
          <Route path="/Project" element={<Project />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
