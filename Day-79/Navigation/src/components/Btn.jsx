import React from "react";
import { useLocation } from "react-router-dom";

function Btn() {
  const loc = useLocation();
  console.log(loc.state);
  return <h1>Hello this is {loc.state.userName}</h1>;
}

export default Btn;
