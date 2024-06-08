import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Provider } from "react-redux";
import Store from "./Redux/Store";
import store from "./Redux/Store";
import CpuContainer from "./Redux/CpuContainer";

function App() {
 

  return (
    <Provider store={store}>
      <h1>CPU Store</h1>
      <CpuContainer></CpuContainer>
    </Provider>
  );
}

export default App;
