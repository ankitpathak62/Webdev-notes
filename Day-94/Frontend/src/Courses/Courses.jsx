import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CoursePaid from "../components/CoursePaid";
import list from "../../public/list.json";

function Courses() {
    console.log(list);
  return (
    <>
      <Navbar></Navbar>
      <div className="min-h-screen">
        <CoursePaid></CoursePaid>
      </div>
      <Footer></Footer>
    </>
  );
}

export default Courses;
