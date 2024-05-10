function Hello() {
    let username  = "Ankit"
    let userfullname =() =>{
        return "Ankit Pathak";
    }
    return <div>
      <h3>Hello this is your instructor {userfullname()}</h3>
    </div>
}
export default Hello;