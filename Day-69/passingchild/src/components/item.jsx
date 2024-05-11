import React from "react";
import Itemlite from "./itemlite";

function Shopitem({ item }) {
  return (
    <>
      <ul className="list-group list-group-flush">
        {item.map((item) => (
          <Itemlite key={item} Shopitem={item}></Itemlite>
        ))}
      </ul>
    </>
  );
}
export default Shopitem;
