// call is a function that helps you to change the context of invoking function. In other words ,it helps you to replace the value of "this" inside a function with whatever value you want.


const p1 = {
    firstname: "Ankit",
    lastname: "Pathak",
    fullname: function (nikname, hobby) {
        return this.firstname + " " + this.lastname + " " + nikname +" "+ hobby
    }
}

const p2 = {
    firstname: "Ankita",
    lastname: "Kumari",

}
//CALL
console.log(p1.fullname.call(p2, "roshni", "martial arts"))

//APPLY
console.log(p1.fullname.apply(p2, ["roshni", "TKD"]))

//BIND
 const result = p1.fullname.bind(p2, "roshni", "Teacher")
console.log(result());
