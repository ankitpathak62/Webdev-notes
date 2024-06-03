import React from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const userName = "Ankit";
  const abc = useNavigate();
  function gotobtn() {
    abc("/btn ", { state: { userName: "Ankit" } });
  }
  return (
    <div>
      <button onClick={gotobtn}>Btn</button>
    </div>
  );
}

export default Home;
