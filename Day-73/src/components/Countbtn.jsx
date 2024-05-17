import React from "react";
import { MdAdd } from "react-icons/md";
import { FaMinus } from "react-icons/fa";
import { useContext } from "react";
import { CountContext } from "./context/Counter.jsx"; // Corrected the path

function Countbtn() {
  const { count, setCount } = useContext(CountContext);
  return (
    <>
      <button onClick={()=> CountContext.setCount(CountContext.count +1)} >
        <MdAdd />
      </button>
      <button onClick={()=> CountContext.setCount(CountContext.count - 1)} >
        <FaMinus />
      </button>
    </>
  );
}

export default Countbtn;
