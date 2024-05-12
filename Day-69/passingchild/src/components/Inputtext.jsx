import React from 'react'

const Inputtext = () => {
    const handleOnChange = (event) => {
        console.log(event.target.value);
    }
  return (
    <>
     <input 
      type="text" placeholder="Search items"
      onChange={handleOnChange}/> 
    </>
  )
}

export default Inputtext
