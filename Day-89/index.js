const express = require("express");
const fs = require("fs");
const status = require("express-status-monitor");
const zlib = require("zlib");

const app = express();
const PORT = 3800;

//stream --> (zip) -->user

app.use(status());

app.get("/", (req, res) => {
  const stream = fs.createReadStream("./textfile.txt", "utf-8");
  stream.on("data", (chunk) => {
    res.write(chunk);
  });
  stream.on("end", () => res.end());
});

fs.createReadStream("./textfile.txt").pipe(
  zlib.createGzip().pipe(fs.createWriteStream("./textfile.zip"))
);

app.listen(PORT, () => console.log("Server Start"));
