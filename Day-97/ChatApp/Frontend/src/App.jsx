import React from "react";
import Left from "./home/left/Left";
import Right from "./home/right/Right";
import Logout from "./home/left1/Logout";
import Signup from "./components/Signup";
import Login from "./components/Login";
import { useAuth } from "./context/AuthProvider";

function App() {
  const [authUser, setAuthUser ] =useAuth()
  console.log(authUser);
  
  return (
   
    <>
      {/* <div className="flex h-screen">
        <Logout></Logout>
        <Left></Left>
        <Right></Right>
      </div> */}

      <Signup />
      {/* <Login></Login> */}
    </>
  );
}

export default App;
