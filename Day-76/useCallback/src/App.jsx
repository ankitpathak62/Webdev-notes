import React, { useCallback, useState } from "react";
import Child from "./Child";

const App = () => {
  const [add, setadd] = useState(0);
  const [minus, setminus] = useState(0);
  const print = useCallback(() => {
    //Abc
  }, [minus]);

  return (
    <>
      <Child print={print}></Child>
      <h1>{add}</h1>
      <button onClick={() => setadd(add + 1)}>Add 1 </button>
      <h1>{minus}</h1>
      <button onClick={() => setminus(minus + 1)}>Minus 1 </button>
    </>
  );
};
export default App;
