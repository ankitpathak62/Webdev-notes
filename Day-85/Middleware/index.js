const express = require("express");
const fs = require("fs");
const users = require("./MOCK_DATA.json");

const app = express();

const PORT = 3300;

// app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  console.log("Middleware 1 is runnning");
  req.myNum = "8709812345";
  next();
});
app.use((req, res, next) => {
  //db query
  //ac nu info
  req.acNum = "987654";
  next();
});

//ROUTES
app.get("/api/users", (req, res) => {
  return res.json(users);
});

app.post("/api/users", (req, res) => {
  const body = req.body;
  console.log(body);
  users.push({ ...body, id: users.length + 1 });
  fs.writeFile("./MOCK_DATA.json", JSON.stringify(users), (err, data) => {
    return res.json({ status: "Success", id: users.length + 1 });
  });
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
    return res.json({ status: "pending" });
  })
  .delete((req, res) => {
    //delete a user
    return res.json({ status: "pending" });
  });

app.listen(PORT, () =>
  console.log(`Server Start on Port Number ${PORT} congratulation...`)
);
