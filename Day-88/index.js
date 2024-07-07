const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3500;

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

// const upload = multer({ dest: "uploads/" });
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    return cb(null, `${Date.now} -${file.originalname}`);
  },
});
const upload = multer({ storage: storage });
app.get("/", (req, res) => {
  return res.render("HomePage");
});

app.post("/upload", upload.single("Img"), (req, res) => {
  console.log(req.body);
  console.log(req.file);

  return res.redirect("/");
});

app.listen(PORT, () => console.log(`Server Start`));
