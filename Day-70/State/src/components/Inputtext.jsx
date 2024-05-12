import React from "react";

// const handleOnChange =  => {
//   // ;
//   // settextstate(event.target.value)
// };
const Inputtext = () => {
  
  return (
    <>
     
      <input type="text" placeholder="Search items" onChange={(event) =>console.log(event.target.value) } />
    </>
  );
};

export default Inputtext;
