const express = require("express");

const app = express();
const PORT = 5500;

app.get("/", (req, res) => {
  return res.json({ message: `Hello ${process.pid}` });
});


app.listen(PORT, () => {
  console.log(`Server Start`);
});
