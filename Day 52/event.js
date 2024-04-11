const btn = document.querySelector("button");

let currentMode = "Light";
const body = document.querySelector("body");
btn.addEventListener("click", () => {
  // console.log("Change mode");

  if (currentMode === "Light") {
    currentMode = "dark";
    body.classList.add("dark");

    body.classList.remove("light");
  } else {
    currentMode = "Light";
    body.classList.add("light");
  }
  console.log(currentMode);
});

// btn.ondblclick = (evt) => {
//   console.log("kya apne subscribe kiya1");
//   console.log(evt.clientY);
// };

// btn.ondblclick = (evt) => {
//   console.log("kya apne subscribe kiya2");
//   console.log(evt.clientY);
// };

// btn.onmouseover = () => {
//   console.log("kya apne subscribe kiya");
// };

// let fun = () =>{
//     console.log("kya apne subscribe kiya3");
//     alert("Thanks for Subscribe")
// }

// btn.addEventListener("click",() => {
//       console.log("kya apne subscribe kiya1");
//     })

// btn.addEventListener("click",() => {
//       console.log("kya apne subscribe kiya2");
//     })

// btn.addEventListener("click", fun)
// btn.removeEventListener("click",fun)
