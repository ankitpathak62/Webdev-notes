const express = require("express");
const fs = require("fs");
const userRouter = require("./routes/user");
const { connectMongoDb } = require("./connection");
const { logReqRes } = require("./middleware/index");
app.use("/api/user", userRouter);

const app = express(); // Define app here

const PORT = process.env.PORT || 3300;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

connectMongoDb("mongodb://127.0.0.1:27017/Youtubeapp").then(() =>
  console.log("MongoDb Connected...")
);

app.use(logReqRes("logupdate.txt"));

app.use("/api/user", userRouter); // Now you can use app

app.listen(PORT, () =>
  console.log(`Server Start on Port Number ${PORT} congratulation...`)
);
