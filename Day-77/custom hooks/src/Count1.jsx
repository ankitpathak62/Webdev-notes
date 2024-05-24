import React from "react";
import useCounter from "./useCounter";

const Count1 = () => {
  const [count, Add, Minus, Mult] = useCounter();
  return (
    <div>
      <h1>count is {count}</h1>
      <button onClick={Add}>+</button>
      <button onClick={Minus}>-</button>
      <button onClick={Mult}>*</button>
    </div>
  );
};

export default Count1;
