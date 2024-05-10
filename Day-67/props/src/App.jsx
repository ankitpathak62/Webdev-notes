import React from "react";
import Empty from "./components/Empty";
import Shopitem from "./components/item";
let Items = [
  "Oil",
  "Icecream",
  "Charger",
  "Cloths",
  "Lights",
  "Books",
  "Toy",
  "Notebook",
];
function App() {
  return (
    <>
      
      <center>
        <h1>SHOP Status</h1>

        <Empty item={Items}></Empty>
        <Shopitem item={Items}></Shopitem>
      </center>
    </>
  );
}

export default App;
