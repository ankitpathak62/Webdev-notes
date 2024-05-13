import React from "react";
import styles from "./itemlite.module.css";
const Itemlite = ({ Shopitem, buybtn, handleBuyBtn }) => {
  return (
    <>
      <div className={styles.divv}>
        <li
          className={` list-group-item     ${
            buybtn &&
            "list-group-item list-group-item-action list-group-item-warning    "
          }`}
        >
          {Shopitem}
          <button onClick={handleBuyBtn} className={`${styles.btn} `}>
            Buy
          </button>
        </li>
      </div>
    </>
  );
};

export default Itemlite;
