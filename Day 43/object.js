// Singleton

//Object literals

// Object.create()

// let myArray = ["Ankit", 20]
// myArray[0]

// const userAbc = {
//   0: "Ankit",
//   age: 20,
//   contact: 9876541230,
// };

// console.log(userAbc.age)
// console.log(userAbc['age'])
// console.log(userAbc);

 

// const mySym = Symbol("Sym1")
// const userAbc = {
//     0: "Ankit",
//     [mySym] : "my key 1",
//     age: 20,
//     contact: 9876541230,
//   };
  
// console.log(userAbc[mySym]);


// const userAbc = {
//     username: "Ankit",
//     age: 20,
//     contact: 9876541230,
//   };

// userAbc.username ="Ankit Pathak  123"
// console.log(userAbc);
// Object.freeze(userAbc)
// userAbc.username ="Ankit Pathak"
// console.log(userAbc);



//saadi.com

// const saadiUser = new Object()
// const saadiUser = { 
// }

// saadiUser.id = 123456
// saadiUser.name = "Abhishek"
// saadiUser.email = "abhishek@gmail.com"
// saadiUser.isLoggedIn = false
 
// console.log(saadiUser);


// const uber = {
//     id:123456,
//     email: "ankit@gmail.com",
//     userName:{
//         userFullName: {
//             userFirstname:"Ankit",
//             userLastName: "Pathak"
//         },
//         userSecondaryName:"Raj"
//     }
// // }
// console.log(uber.userName?.userSecondaryName);



// const user1 = {
//         username: "Ankit",
//         age: 20,
//         contact: 9876541230,
//       };

// const user2 = {
//         username1: "Ankita",
//         age1: 21,
//         contact1: 6556561230,
//       };

// // const user3 ={user1,user2}
// const user3 = Object.assign (user2,user1)
// console.log(user3);


// console.log(user3);


// const target = { a: 1, b: 2 };
// const source = { d: 4, c: 5 };
// const source1 = { e: 4, f: 5 };

// // const returnedTarget = Object.assign({},target, source,source1);
// const returnedTarget = Object.assign({},target, source,source1);
// console.log(target);
// console.log(returnedTarget);


// const user4 = {...source,...source1,...target,...user1,...user2}
// console.log(user4);

// const userA = [
//     {
//         id:456,
//         email:"hjsdh"
//     },
//     {
//         id:658,
//         email:"sjd"
//     },
//     {
//         id:65458,
//         email:"sj454d"
//     },
// ]
// // console.log(userA[1].id);

// console.log(Object.keys(userA));
// console.log(Object.values(userA));
// console.log(Object.entries(userA));

 


// const uber = {
//     id:123456,
//     email: "ankit@gmail.com",
//     isLoggedIn :true,
//     userName:{
//         userFullName: {
//             userFirstname:"Ankit",
//             userLastName: "Pathak"
//         },
//         userSecondaryName:"Raj"
//     }
// }

// console.log(uber.hasOwnProperty('contact'));


//Object De-Structuring 

// const product = {
//     productName : "Laptop",
//     price : 60000,
//     Brand: "hp",
//     Ram: "16GB"
// }

// console.log(product.Ram);
// console.log(product.Brand);

// const {productName } = product
// const {productName : pName } = product
// console.log(pName);


// {
//     userName : "Ankit"
    
// }

// [
//     {

//     },
//     {

//     },
//     {

//     }
// ]