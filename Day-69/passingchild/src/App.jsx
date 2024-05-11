import React from "react";
import Empty from "./components/Empty";
import Shopitem from "./components/item";
import "./App.css";
import Head from "./components/Head";
import Container from "./components/Container";
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
      {" "}
      <Container>
        <center>
          <Head></Head>

          <Empty item={Items}></Empty>
          <Shopitem item={Items}></Shopitem>
        </center>
      </Container>
      
    </>
  );
}

export default App;
