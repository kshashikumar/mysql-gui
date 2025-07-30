const express = require("express");
const configController = require("../controllers/configController");
const configRouter = express.Router();

configRouter.post("/", configController.updateConfig);
configRouter.get("/", configController.readConfig);

module.exports = configRouter;
