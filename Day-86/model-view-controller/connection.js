const mongoose = require("mongoose");
mongoose.set("strictQuery", true);


async function connectMongoDb(url) {
  return mongoose.connect(url);
}

module.exports = { connectMongoDb };
