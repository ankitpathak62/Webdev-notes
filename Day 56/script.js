const xhr = new XMLHttpRequest();
const requesturl = "https://api.github.com/users/ankitpathak62";
xhr.open("GET", requesturl);

// console.log("Hello")

xhr.onreadystatechange = function () {
    console.log(xhr.readyState);
    if ( xhr.readyState === 4) {
        const data = JSON.parse(this.responseText)
        console.log(typeof data);
        console.log(data.name);

    }
};
xhr.send();