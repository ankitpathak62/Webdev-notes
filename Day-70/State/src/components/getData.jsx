import React from "react";

const GetData = (props) => {
  return (
    <>
    <button onClick={()=> alert("Hello")}>Abc</button>
      <button onClick={props.data}>Confirm</button>
    </>
  );
};

export default GetData;
