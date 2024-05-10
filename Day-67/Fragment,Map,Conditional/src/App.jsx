import React from "react";
//let Items = [];
let Items = ["Oil", "Icecream", "Charger", "Cloths", "Lights","Books","Toy","Notebook"]

// let Empty = Items.length === 0 ? <h4>Shop is Empty</h4> :null

function App() {
  // if(Items.length === 0){
  //   return <h4>Shop is close</h4>
  // }
  return (
    <>
      <center>
        <h1>SHOP Status</h1>

        {Items.length === 0 && <h4>Shop is Empty</h4>}

        <ul className="list-group list-group-flush">
          {Items.map((item) => (
            <li key={item} class="list-group-item">
              {item}
            </li>
          ))}
        </ul>
      </center>
    </>
  );
}
export default App;
