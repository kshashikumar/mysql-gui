const express = require("express");
const connectionController = require("../controllers/connectionController");
const connectionRouter = express.Router();

connectionRouter.get("/", connectionController.getConnections);
connectionRouter.post("/add", connectionController.addConnection);
connectionRouter.post("/edit/:id", connectionController.editConnection);
connectionRouter.delete("/delete/:id", connectionController.deleteConnection);
connectionRouter.post("/save-connections", connectionController.saveConnections);

module.exports = connectionRouter;
