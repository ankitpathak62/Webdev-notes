import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);
  const [data, setdata] = useState("Ankit");
  useEffect(() => {
    console.log("Abc");
  }, [count] );

function update() {
  setdata("Ankita")
}

  return (
    <>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button onClick={update}>Update Karo</button>
      </div>
    </>
  );
}

export default App;
