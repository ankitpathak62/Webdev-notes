import styles from "./Inputtext.module.css";


const Inputtext = ({ handleKeyDown }) => {
  return (
    <input
      type="text"
      placeholder="Enter Food Item here"
      className={styles.Input}
      onKeyDown={handleKeyDown}
    />
  );
};

export default Inputtext;
