import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [width, setWidth] = useState(window.screen.width);
  function actualWidth() {
    console.log(window.innerWidth);
    setWidth(window.innerWidth)
  }
  useEffect( () => {
    console.log("add");
    window.addEventListener("resize",actualWidth)
return ()=> {
  console.log("SUb");
  window.removeEventListener("resize",actualWidth)
}
  })
   
  

  return (
    <>
      <h1>Screen size {width}</h1>
    </>
  );
}

export default App;
