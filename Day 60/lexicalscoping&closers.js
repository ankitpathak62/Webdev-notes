// function init() {
//     let name = "Mozilla";  
//     function displayName() {

//       console.log(name);  
//     }
//     displayName();
//   }
//   init();


// function outer() {
//     let user = "Ankit"
//     function small (){
//         let username = "kabir"
//         console.log(username)
//     }
//     function small2 (){
//         console.log(username)
//     }
//     // small()
//     small2()
// }
// outer()
// console.log(user);


//closer

function makeFunc() {
    const name = "Mozilla";
    function displayName() {
      console.log(name);
    }
    return displayName;
  }
  
  const myFunc = makeFunc();
  myFunc();
  