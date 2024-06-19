const express = require("express");
const users = require("./MOCK_DATA.json");

const app = express();

const PORT = 3300;

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
  //Create new user
  return res.json({ status: "pending" });
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
