import React from "react";
import Empty from "./components/Empty";
import Shopitem from "./components/item";
import "./App.css"
import Head from "./components/Head";
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
         <Head></Head>

        <Empty item={Items}></Empty>
        <Shopitem item={Items}></Shopitem>
      </center>
    </>
  );
}

export default App;
