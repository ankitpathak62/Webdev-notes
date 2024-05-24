import { useState } from "react";

const useCounter = (initialvalue = 1) => {
  const [count, setCount] = useState(initialvalue);
  function Add() {
    setCount(count + 5);
  }
  function Minus() {
    setCount(count - 1);
  }
  function Mult() {
    setCount(count * 2);
  }
  return [count, Add, Minus, Mult];
};

export default useCounter;
