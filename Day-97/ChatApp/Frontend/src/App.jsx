import React from "react";
import Left from "./home/left/Left";
import Right from "./home/right/Right";
import Logout from "./home/left1/Logout";

function App() {
  return (
    <>
      <div className="flex h-screen">
        <Logout></Logout>
        <Left></Left>
        <Right></Right>
      </div>
    </>
  );
}

export default App;
