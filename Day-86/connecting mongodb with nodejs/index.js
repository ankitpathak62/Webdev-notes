const express = require("express");
const fs = require("fs");
const { Db } = require("mongodb");
const mongoose = require("mongoose");

const app = express();

const PORT = 3300;

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ extended: false }));

mongoose
  .connect("mongodb://127.0.0.1:27017/Youtubeapp")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("Error", err));

//Schema
const userSchema = new mongoose.Schema({
  Name: {
    type: String,
    require: true,
  },
  email: {
    type: String,
    require: true,
    unique: true,
  },
});

//Model
const User = mongoose.model("user", userSchema);

//middleware
app.use((req, res, next) => {
  console.log("Middleware 1 is runnning");
  fs.appendFile("log.txt", `\n${Date.now()}:${req.ip}\n`, (err, data) => {
    next();
  });
});
app.use((req, res, next) => {
  //db query
  //ac nu info
  req.acNum = "987654";
  next();
});

//ROUTES
app.get("/api/users", (req, res) => {
  res.setHeader("X-myAccount", "987654");
  console.log(req.headers);
  return res.json(users);
});

app.post("/api/users", async (req, res) => {
  const body = req.body;
  if (!body || !body.Name || !body.email || !body.gender) {
    return res.status(400).json({msg: "Name, email, and gender are required"});
  }
  
  const result = await User.create({
    Name: body.Name,
    email: body.email,
    gender : body.gender
  });
  console.log(result);
  return res.status(201).json({ msg: "User created successfully" });
});

app
  .route("/api/users/:id")
  .get((req, res) => {
    const id = Number(req.params.id);
    const user = users.find((user) => user.id === id);
    return res.json(user);
  })
  .patch((req, res) => {
    //edit a user
    return res.json({ status: "Update operation pending" });
  })
  .delete((req, res) => {
    //delete a user
    return res.json({ status: "Delete operation pending" });
  });

app.listen(PORT, () =>
  console.log(`Server Start on Port Number ${PORT} congratulation...`)
);
