import { useContext } from "react";
import "./App.css";
import Countbtn from "./components/Countbtn.jsx";
import { CountContext } from "../context/Counter.jsx"; // Corrected the path

function App() {
  const { count } = useContext(CountContext);
  console.log(count);

  return (
    <>
      <h1>Count is {count}</h1>
      <Countbtn />
    </>
  );
}

export default App;
