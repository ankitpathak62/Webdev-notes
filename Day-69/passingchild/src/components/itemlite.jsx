import React from "react";
 import styles from "./itemlite.module.css"
function Itemlite( {Shopitem}) {
   
const BuyBtn =() => {
  
}

  return (
    <>
    <div className={styles.divv}>
      <li   class=" abc list-group-item">
        {Shopitem}
        <button  onClick= {() => console.log( `${Shopitem} buy`)} className={styles.btn}  >Buy</button>
      </li>
      
      </div>
    </>
  );
}
export default Itemlite;
