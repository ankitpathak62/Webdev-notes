const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3500;

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./uploads");
  },

  filename: function (req, file, cb) {
    return cb(null, ` ${file.originalname}`);
  },
});
const upload = multer({ storage: storage });
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  return res.render("Homepage");
});

app.post("/upload", upload.single("Img"), (req, res) => {
  console.log(res.body);
  console.log(res.file);
  return res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server Start`);
});
