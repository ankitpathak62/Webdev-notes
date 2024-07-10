const cluster = require("node:cluster");
const express = require("express");
const os = require("os");

const numofCpu = os.cpus().length;

if (cluster.isPrimary) {
  for (let i = 0; i < numofCpu; i++) {
    cluster.fork();
  }
} else {
    
  const app = express();
  const PORT = 5500;

  app.get("/", (req, res) => {
    return res.json({ message: `Hello ${process.pid}` });
  });

  app.listen(PORT, () => {
    console.log(`Server Start`);
  });
}
