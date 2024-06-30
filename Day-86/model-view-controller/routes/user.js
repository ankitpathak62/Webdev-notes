const express = require("express");
const {
  handlePostAll,
  handleGetAll,
  handleGetById,
  handleDeleteById,
  handlePatchById,
} = require("../controller/user");

const router = express.Router();

router.route("/").get(handleGetAll).post(handlePostAll);

router
  .route("/:id")
  .get(handleGetById)
  .patch(handlePatchById)
  .delete(handleDeleteById);

module.exports = router;
