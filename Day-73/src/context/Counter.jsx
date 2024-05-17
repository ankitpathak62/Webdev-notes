import { createContext, useState } from "react";
import React from "react";

export const CountContext = createContext(null);

export default function Counter({ children }) {
  const [count, setCount] = useState(6);
  return (
    <CountContext.Provider value={{ count, setCount }}>
      {children}
    </CountContext.Provider>
  );
}
