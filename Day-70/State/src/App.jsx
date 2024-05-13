import React from "react";
import Empty from "./components/Empty";
import Shopitem from "./components/item";
import "./App.css";
import Head from "./components/Head";
import Container from "./components/Container";
import GetData from "./components/getData";
import Inputtext from "./components/Inputtext";
import { useState } from "react";
 
function App() {
  let [textshow, settextstate] = useState("User last enter");

 


  let [Items, setnewItem] = useState(["chai" ]);

  const onKeyDown = (event) => {
    if (event.key === "Enter") {
      let newItem = event.target.value;
      let newShopItem = [...Items,newItem]
      console.log("new item is " + newItem);
      setnewItem(newShopItem)
      settextstate(event.target.value)
      
    }
  };
  return (
    <>
      <Container>
        <center>
          <Head></Head>

          <Empty item={Items}></Empty>

          <Inputtext  handleKeyDown={onKeyDown}></Inputtext>
          <p>{"User last enter is " + textshow}</p>
          <Shopitem item={Items}></Shopitem>
        </center>
      </Container>
    </>
  );
}

export default App;
