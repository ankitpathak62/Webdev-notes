import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { useRef } from 'react'
 
 
// const refObject = useRef(initial value)
function App() {
  const[Name,setName] =useState(" ")
  const refObject = useRef()
  console.log(refObject)

  function Reset() {
    setName("")
    refObject.current.focus()
  }
  function Default() {
    refObject.current.value= "Ankit"
    refObject.current.focus()
  }

  return (
    <>
       
      <h1>Sunfire Sensei</h1>
       <input ref={refObject} type='text' value={Name} onChange={(event) => setName(event.target.value)}></input>
       <button onClick={Reset}>Reset</button>
       <button onClick={Default}>Default</button>
       
      
    </>
  )
}

export default App
