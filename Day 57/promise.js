// const promise1 = new Promise(function (resolve, reject) {
//     setTimeout(function () {
//         console.log("promise1");
//         resolve()
//     }, 1000)
// })

// promise1.then(function () {
//     console.log('consume');
// })

//method 2

// new Promise(function (resolve, reject) {
//     setTimeout(function () {
//         console.log("promise2");
//         resolve()
//     }, 1000)
// }).then(function () {
//     console.log(
//         "consume2"
//     );
// })

//method 3

// const promise3 = new Promise(function (resolve,reject) {
//     setTimeout(function () {
//         resolve({ username: "Ankit", password: "6325" })
//     }, 1000)

   
// })
// promise3.then(function (useeeer) {
//     console.log(useeeer);
// })


//method 4


const promise4 = new Promise(function(resolve,reject){
    setTimeout(function(){
        let error=false
        try {
            resolve({username: "Ankit", password: "65"})
        } catch (error) {
            reject("error")
        }
        
    },1000)
})
promise4.then( (user) => {
    console.log(user);
}

).catch(function(){
    console.log("error");
})