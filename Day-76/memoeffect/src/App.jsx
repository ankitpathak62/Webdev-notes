import React, { useMemo, useState } from "react";

const App = () => {
  const [sum, setsum] = useState(0);
  const [minus, setminus] = useState(1000);
  const multi = useMemo(function multi() {
    console.log("Hello this is your sensei Ankit ");
    return sum * 5;
  }, [minus]);

  return (
    <>
      <h1>Sunfire Sensei</h1>
      {multi}
      <br></br>
      <button onClick={() => setsum(sum + 1)}>+</button>
      <span>{sum}</span>
      <br></br>
      <button onClick={() => setminus(minus - 1)}>-</button>
      <span>{minus}</span>
    </>
  );
};

export default App;
