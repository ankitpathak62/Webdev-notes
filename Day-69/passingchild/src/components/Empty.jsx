import React from "react"

 
function Empty({item}) {
    return <>{item.length === 0 && <h4>Shop is Empty</h4>}</>
}
export default Empty