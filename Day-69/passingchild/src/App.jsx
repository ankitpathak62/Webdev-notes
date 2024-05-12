import React from "react";
import Empty from "./components/Empty";
import Shopitem from "./components/item";
import "./App.css";
import Head from "./components/Head";
import Container from "./components/Container";
import GetData from "./components/getData";
import Inputtext from "./components/Inputtext";
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
let textshow = "Item Entered by user"
function App() {

  function alertt() {
    alert("ready to buy")
  }

  const handleOnChange = (event) => {
    console.log(event.target.value)
    textshow(event.target.value)
  }
   return (
    <>
       
      <Container>
        <center>
          <Head></Head>

          <Empty item={Items}></Empty>
          
          <Inputtext handleOnChange = {handleOnChange}></Inputtext>
          <p>{textshow}</p>
          <Shopitem item={Items}></Shopitem>
          <GetData data={alertt}></GetData>
        </center>
      </Container>
      
    </>
  );
}

export default App;
