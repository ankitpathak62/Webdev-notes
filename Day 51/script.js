// const div = document.querySelector("p")
// console.log(div);
// const abc =  div.getAttribute("class")
// console.log(abc);

// let p = document.querySelector("p")
// console.log(p.getAttribute("name"));

// let p = document.querySelector("p")
// console.log(p.setAttribute("name","Ankit"));

// let p = document.querySelector("h1")
// console.log(p);
// p.style.backgroundColor = "green"

const button = document.createElement("button");
console.log(button);
button.innerText= "Subscribe"
let p = document.querySelector("h2")
// p.append(button)
// p.prepend(button)
// p.before(button)
// p.after(button)
p.remove("h2")

const newh2 = document.createElement("h2")
newh2.innerText= "Welcome again"
document.querySelector("h1").after(newh2)