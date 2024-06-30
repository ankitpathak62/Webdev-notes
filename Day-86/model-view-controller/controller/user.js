const User = require("../model/user");

async function handlePostAll(req, res) {
  const body = req.body;
  if (!body || !body.Name || !body.email || !body.gender) {
    return res
      .status(400)
      .json({ msg: "Name, email, and gender are required" });
  }

  try {
    const result = await User.create({
      Name: body.Name,
      email: body.email,
      gender: body.gender,
    });
    console.log(result);
    return res.status(201).json({ msg: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ msg: "Server error" });
  }
}

async function handleGetAll(req, res) {
  try {
    // Replace with actual logic to fetch all users from your data source (MongoDB)
    const users = await User.find();
    return res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ msg: "Server error" });
  }
}

async function handleGetById(req, res) {
  const id = req.params.id;
  try {
    // Replace with actual logic to fetch a user by id from your data source (MongoDB)
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    return res.json(user);
  } catch (error) {
    console.error("Error fetching user by id:", error);
    return res.status(500).json({ msg: "Server error" });
  }
}

async function handlePatchById(req, res) {
  // Implement update logic here
  return res.json({ status: "Update operation pending" });
}

async function handleDeleteById(req, res) {
  // Implement delete logic here
  return res.json({ status: "Delete operation pending" });
}

module.exports = {
  handlePostAll,
  handleGetAll,
  handleGetById,
  handleDeleteById,
  handlePatchById,
};
