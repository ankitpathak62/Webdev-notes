import React from "react";
import useCounter from "./useCounter";

const Count2 = () => {
  const [count, Add, Minus, Mult] = useCounter(100);
  return (
    <div>
      <h1>count is {count}</h1>
      <button onClick={Add}>+</button>
      <button onClick={Minus}>-</button>
      <button onClick={Mult}>*</button>
    </div>
  );
};

export default Count2;
