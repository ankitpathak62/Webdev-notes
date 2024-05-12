import React from "react";
 import styles from "./itemlite.module.css"
function Itemlite( {Shopitem}) {
   
const BuyBtn =(event) => {
  console.log(event)
  console.log( `${Shopitem} buy`)
}

  return (
    <>
    <div className={styles.divv}>
      <li   class=" abc list-group-item">
        {Shopitem}
        <button  onClick= {(event) => BuyBtn(event)} className={styles.btn}  >
          Buy</button>
      </li>
      
      </div>
    </>
  );
}
export default Itemlite;
