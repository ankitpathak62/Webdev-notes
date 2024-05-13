import React from "react";
import Itemlite from "./itemlite";
import { useState } from "react";

function Shopitem({ item }) {
  let [activeItems, setActiveItems] = useState([]);

  let onbuybtn = (item , event) => {
    let newItem = [...activeItems,item]
    setActiveItems(newItem)
  };
  return (
    <>
      <ul className="list-group list-group-flush">
        {item.map((item) => (
          <Itemlite
            key={item}
            buybtn={activeItems.includes(item)}
            Shopitem={item}
            handleBuyBtn={(event) => onbuybtn(item,event )}
          ></Itemlite>
        ))}
      </ul>
    </>
  );
}
export default Shopitem;
