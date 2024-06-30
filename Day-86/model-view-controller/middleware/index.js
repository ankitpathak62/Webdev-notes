const fs = require("fs");
function logReqRes(filename) {
  return (req, res, next) => {
    console.log("Middleware 1 is runnning");
    fs.appendFile(filename, `\n${Date.now()}:${req.ip}\n`, (err, data) => {
      next();
    });
  };
}
module.exports = {
  logReqRes,
};
