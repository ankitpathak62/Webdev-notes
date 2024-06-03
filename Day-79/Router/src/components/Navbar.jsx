import React from "react";
import { FaInstagram } from "react-icons/fa";
import { FaLinkedin } from "react-icons/fa";
import { FaGithub } from "react-icons/fa6";

const Navbar = () => {
  return (
    <nav className="   mb-20 flex items-center justify-between py-6">
      <div className="  flex flex-shrink-0 items-center text-4xl">
        <p className="mx-2 w-10">RB</p>
      </div>
      <div
        className="m-8 flex items-center justify-center gap-4 text-2xl
         "
      >
        <a href="#">Experience</a>
        <a href="#">Project</a>
      </div>
    </nav>
  );
};

export default Navbar;
