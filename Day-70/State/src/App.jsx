import React from "react";
import Empty from "./components/Empty";
import Shopitem from "./components/item";
import "./App.css";
import Head from "./components/Head";
import Container from "./components/Container";
import GetData from "./components/getData";
import Inputtext from "./components/Inputtext";
import { useState } from "react";
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

 let textState = useState("Item Entered by user")
  let textshow = textState[0]
  let settextstate = textState[1]
  console.log(textshow )


  

  const handleOnChange = (event) => {
    settextstate(event.target.value)
    // console.log(event.target.value)
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
          
        </center>
      </Container>
      
    </>
  );
}

export default App;
