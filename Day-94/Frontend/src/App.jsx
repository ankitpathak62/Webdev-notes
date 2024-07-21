import React from "react";
import Home from "./home/Home";

import { Route, Routes } from "react-router-dom";
import Courses from "./Courses/Courses";

const App = () => {
  return (
    <>
      <div className="dark:bg-slate-900 dark:text-white">
        <Routes>
          <Route path="/" element={<Home></Home>}></Route>
          <Route path="/course" element={<Courses></Courses>}></Route>
        </Routes>
      </div>
    </>
  );
};

export default App;
