let boxes = document.querySelectorAll(".box");
let resetBtn = document.querySelector("#reset-btn");
let newGame = document.querySelector("#newGame");
let msgContainer = document.querySelector(".msg-container");
let msg = document.querySelector("#msg");
let hid = document.querySelector(".hide")

let turn0 = true;

const winPatterns = [
  [0, 1, 2],
  [0, 3, 6],
  [0, 4, 8],
  [1, 4, 7],
  [2, 5, 8],
  [2, 4, 6],
  [3, 4, 5],
  [6, 7, 8],
];

const disableBoxes = () =>{
  for (let box of boxes) {
    box.disabled = true;
  }
}
const enableBoxes = () =>{
  for (let box of boxes) {
    box.disabled = false;
    box.innerText = "";
  }
}

 
const showWinner = (winner) => {
  msg.innerText = `Congratulations, Winner is ${winner}`;
  msgContainer.classList.remove("hide");
  disableBoxes();
   
};

boxes.forEach((box) => {
  box.addEventListener("click", () => {
    if (turn0 === true) {
      box.innerText = "0";
      turn0 = false;
    } else {
      box.innerText = "X";
      turn0 = true;
    }
    box.disabled = true;
    checkWinner();
  });
});

const checkWinner = () => {
  for (let pattern of winPatterns) {
    let Val1 = boxes[pattern[0]].innerText;
    let Val2 = boxes[pattern[1]].innerText;
    let Val3 = boxes[pattern[2]].innerText;

    if (Val1 != "" && Val2 != "" && Val3 != "") {
      if (Val1 === Val2 && Val2 === Val3) {
        console.log("winner", Val1);
        showWinner(Val1);
      }
    }
  }
};



const resetGame = () => {
  turnO = true;
  count = 0;
  enableBoxes();
  msgContainer.classList.add("hide");
};

newGame.addEventListener("click",resetGame)
resetBtn.addEventListener("click",resetGame)