let obj1 = {
    user: "Ankit",
    password: "123",
    userfullname : "Ankit2 Pathak" 
}
console.log(obj1);

let obj2 = {
    warning : ()=> {
        alert("please enter your password")
    },
    userfullname : "Ankit Pathak" 
}

obj2.__proto__ ={
    username:"ankit688"
}

obj1.__proto__ = obj2
console.log(obj1.username);