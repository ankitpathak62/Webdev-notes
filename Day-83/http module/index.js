const http = require("http");
const fs = require("fs");
const { URL } = require("url");

const myServer = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") return res.end();
  const log = `${Date.now()}: ${req.method} ${req.url} New Request\n`;
  const newUrl = new URL(req.url, `http://${req.headers.host}`);
  console.log(newUrl);
  fs.appendFile("request.txt", log, (err) => {
    if (err) console.error(err);
  });

  switch (newUrl.pathname) {
    case "/":
      if (req.method === "GET") res.end("Welcome to youtube");
      break;
    case "/channel":
      const user = newUrl.searchParams.get("myname");
      if (user) {
        res.end(`Hi ${user}, welcome to Sunfire Sensei`);
      } else {
        res.statusCode = 400;
        res.end("Bad Request");
      }
      break;
    case "/form":
      if (req.method === "GET") {
        res.end("This is a form");
      } 
      else if (req.method === "POST") {
        //DATABASE QUERY
        res.end("success")
      }
    default:
      res.statusCode = 404;
      res.end("404 Not Found");
  }
});

myServer.listen(8000, () => console.log("Server Started!"));
