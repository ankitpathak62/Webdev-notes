const http = require("http");

const express = require("express");

const app = express();

app.get("/", (req, res) => {
  return res.send(`Hello ${req.query.name} Welcome to our server `);
});
app.get("/contact", (req, res) => {
  return res.send(`Hello ${req.query.name} Welcome to our contact `);
});
app.get("/about", (req, res) => {
  return res.send(
    `Welcome to our about page Hello ${req.query.name} How are you?`
  );
});

app.listen(6500, () => console.log("Hamara server Start ho gya!"));

const myServer = http.createServer(app);
