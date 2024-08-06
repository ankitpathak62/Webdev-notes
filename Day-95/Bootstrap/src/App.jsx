import React from "react";
import NavScrollExample from "./components/Navbar";
import "bootstrap/dist/css/bootstrap.min.css";
import TypesExample from "./components/Button";
import Cardd from "./components/Card";

function App() {
  return (
    <>
      <h1>Sunfire Sensei</h1>
      <NavScrollExample></NavScrollExample>
      <TypesExample></TypesExample>
      <Cardd></Cardd>
    </>
  );
}

export default App;
