const fs = require("fs");
const os = require("os");

console.log(os.cpus().length);



//to create file
// fs.writeFileSync("./text.txt","hello this is Ankit pathak")
// fs.writeFile("./text.txt","hello Baby This is aman", (err) =>{})



//to read file


// const result = fs.readFileSync("./text.txt","utf-8")
// console.log(result);



// fs.readFile("./text.txt", "utf-8", (err, result) => {
//     if (err) {
//         console.log("Error:", err);
//     } else {
//         console.log(result);
//     }
// });

// console.log("Ankit");
//add somelines
// fs.appendFileSync("./text.txt",`  Hey Buddy \n`)


//copy file
// fs.cpSync("./text.txt", "./abc.js")

//Delete
// fs.unlinkSync("./abc.js")

//check state
// console.log(fs.statSync("./test.js"))


//make folder
// fs.mkdirSync("doc1")
// fs.mkdirSync("doc/js/backend", {recursive:true})