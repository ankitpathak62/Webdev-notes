import React, { memo } from "react";

const Child = ({ print  }) => {
  console.log("Hey this is your sensei Ankit Pathak");
  return <div></div>;
};

export default memo(Child);
