const http = require("http");
const fs = require("fs");

const myServer = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") return res.end();
  const log = `${Date.now()}: ${req.url} New Request\n`;
  fs.appendFile("request.txt", log, (err) => {
    if (err) console.error(err);
  });

  switch (req.url) {
    case "/":
      res.end("Welcome to youtube");
      break;
    case "/channel":
      res.end("Sunfire Sensei");
      break;
    default:
      res.statusCode = 404;
      res.end("404 Not Found");
  }
});

myServer.listen(8000, () => console.log("Server Started!"));
