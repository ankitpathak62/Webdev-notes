import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import Btn from "./components/Btn";
import Home from "./components/Home";

function App() {
  return (
    <>
      <Home></Home>
      <Routes>
        <Route path="/btn" element={<Btn></Btn>}></Route>
      </Routes>
    </>
  );
}

export default App;
