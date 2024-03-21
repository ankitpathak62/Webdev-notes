function allrounder() {
  //do some work
  console.log("Ankit" + "pathak");
  console.log(6 + 989);
  console.log("My name is Ankit");
}

// allrounder()

function math(number1, number2) {
    let result =  number1 + number2;
    // console.log("hello");
  return result;
}
// console.log(math(78,4))
// const mathematicsresult = math(99, 3);
// console.log(mathematicsresult);
 

function vivah(username) {
    if (!username) {
        console.log("please enter your username");
        return;
    }
    return `${username} just logged in`
}
// console.log(vivah("abs"))

// function ecom(...items) {
//     console.log("thank you");
// }
// ecom(1,2,3,4,34,56,7,8,983,4,3)


const user1 = { 
    username:"Ankit",
    email:"ankit@gmail.com"
}
let Array1 = [65,98,65,3,8,15]

function name(objects) {
    console.log(objects[1]);
    // console.log(`My username is ${objects.username} and my email is ${objects.email}`);    
}
// name(user1)
// name(Array1)


const arrowfunctionlearn = (para1,para2) => {
    let sum = para1+ para2
    return sum;
}
 
console.log(arrowfunctionlearn(3,9));