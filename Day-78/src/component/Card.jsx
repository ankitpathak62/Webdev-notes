import React from "react";

const Card = (props) => {
  return (
    <div className="Cardstyle">
      <h3>{props.title}</h3>
      <p>{props.body}</p>
    </div>
  );
};

export default Card;
