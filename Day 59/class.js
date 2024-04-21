//Class

//class is a program-code template for creating objects.


// class Myclass{
//     constructor(){}
//     method(){}
// }

// let myobject = new Myclass()

// class car {
//     start() {
//         console.log("start");
//     }
//     drive() {
//         console.log("drive");
//     }
//     stop() {
//         console.log("stop");
//     }
//     settopspeed(speed) {
//         this.topspeed = speed;
//     }
//     setbrand(brand){
//         this.brandName = brand;
//     }
// }

// let bolero = new car()
//  bolero.settopspeed("140")
//  bolero.setbrand("mahindra")
 
// let scorpio = new car()
// scorpio.settopspeed("180")


//Constructor


// class car {
//     constructor(speed,brand,carname){
//         console.log("this is constructor");
//         this.speed = speed;
//         this.brandName = brand;
//         this.carname= carname;
//     }
//     start() {
//         console.log("start");
//     }
//     drive() {
//         console.log("drive");
//     }
//     stop() {
//         console.log("stop");
//     }
//     // settopspeed(speed) {
//     //     this.topspeed = speed;
//     // }
//     // setbrand(brand){
//     //     this.brandName = brand;
//     // }
// }

// let bolero = new car("140","mahindra","bolero")
// console.log(bolero);
 
// let scorpio = new car("180","mahindra","scorpio")
// console.log(scorpio);
 



 
 
//Inheritane :Inheritance is passing down properties & methods from parents to child class


//  class parentt{
//         abc(){
//             console.log("parent");
//         }
//  }
//  class childd extends parentt{

//  }
//  let obj1 = new childd()
 

class employe {
    constructor(branch){
        console.log("constructor");
        this.branch =  branch
    }
    eat(){
        console.log("eat");
    }
    sleep(){
        console.log("sleep");
    }
    work(){
        console.log("doing simple work");
    }
}
class engineer extends employe {
    constructor(branch){
        super(branch)
    }
    work(){
        console.log("Make new projects");
         
    }
    sleep(){
        console.log("no sleep");
    }
} 
//method overriding : give prefrence to child properties

let Ankit = new engineer( "CSE")


//Super keyword : Super keyword is used to call the constructor of its parents class to acess the parent's properties and methods