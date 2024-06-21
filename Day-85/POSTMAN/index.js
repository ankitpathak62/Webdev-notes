const express = require("express");
const fs = require("fs");
const users = require("./MOCK_DATA.json");

const app = express();

const PORT = 3300;

app.use(express.urlencoded({ extended: false })); 

app.get("/users", (req, res) => {
  const html = `
      <ul>
      ${users.map((user) => `<li>${user.first_name}</li>`)}</ul>`;
  return res.send(html);
});

//ROUTES
app.get("/api/users", (req, res) => {
  return res.json(users);
});

// app.get("/api/users/:id", (req, res) => {
//   const id = Number(req.params.id);
//   const user = users.find((user) => user.id === id);
//   return res.json(user)
// });

app.post("/api/users", (req, res) => {
  const body = req.body;
  console.log(body);
  users.push({ ...body, id: users.length +1 });
  fs.writeFile("./MOCK_DATA.json", JSON.stringify(users), (err, data) => {
    return res.json({ status: "Success", id: users.length + 1 });
  });
});

// app.patch("/api/users/:id",(req,res) =>{
//     //edit a user
//     return res.json({status :"pending"})
// })
// app.delete("/api/users/:id",(req,res) =>{
//     //delete a user
//     return res.json({status :"pending"})
// })

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
