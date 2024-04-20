const URL = "https://api.chucknorris.io/jokes/random"
const joke = document.querySelector("#joke")
const btn = document.querySelector("#button")

const getjokes = async () => {
    console.log("Testing");
    let ANKIT = await fetch(URL)
    console.log(ANKIT);
    let data = await ANKIT.json()
    console.log(data);
    console.log(data.value);
     joke.innerText = data.value

}


// function getjokes() {
//     fetch(URL).then((ANKIT) => {
//         return ANKIT.json()
//     }).then((data) => {
//         console.log(data);
//         joke.innerText = data.value
//     })
    
// }
btn.addEventListener("click", getjokes)