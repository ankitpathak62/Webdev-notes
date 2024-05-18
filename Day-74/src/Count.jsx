import React from "react";
import { useReducer } from "react";

const initialstate = 0;
const reducer = (currentState, action) => {
  switch (action) {
    case "Add":
      return currentState + 1;
    case "Sub":
      return currentState - 1;

    default:
      return currentState;
  }
};

const Count = () => {
 const [state , dispatch] = useReducer(reducer, initialstate);
  return (
    <>
      <h1>Count is {state}</h1>
      <button onClick={() =>dispatch("Add")}>+</button>
      <button onClick={() =>dispatch("Sub")}>-</button>
    </>
  );
};

export default Count;
