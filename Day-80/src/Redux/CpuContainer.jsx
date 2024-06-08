import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Buy_Cpu } from "./CpuAction";

function CpuContainer() {
  const No = useSelector((state) => state.NumberofCpu);
  const dispatch = useDispatch();

  return (
    <>
      <h3>Available CPU in Store = {No}</h3>
      <button onClick={() => dispatch(Buy_Cpu())}> Buy Cpu</button>
    </>
  );
}

export default CpuContainer;
