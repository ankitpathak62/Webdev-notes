import React from "react";
import Home from "./home/Home";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
import Courses from "./Courses/Courses";
import { useAuth } from "./Context/AuthProvider";
import Signup from "./components/Signup";

const App = () => {
  const [authUser, setAuthUser] = useAuth();
  console.log(authUser);
  return (
    <>
      <div className="dark:bg-slate-900 dark:text-white">
        <Routes>
          <Route path="/" element={<Home></Home>}></Route>
          <Route
            path="/course"
            element={authUser ? <Courses></Courses> : <Navigate to="/signup" />}
          ></Route>
          <Route path="/signup" element={<Signup></Signup>}></Route>
        </Routes>
        <Toaster />
      </div>
    </>
  );
};

export default App;
