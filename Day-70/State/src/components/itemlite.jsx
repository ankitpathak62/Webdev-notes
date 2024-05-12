import React from "react";
import styles from "./itemlite.module.css";
const Itemlite = ({ Shopitem, handleBuyBtn }) => {
  return (
    <>
      <div className={styles.divv}>
        <li className="   list-group-item">
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
