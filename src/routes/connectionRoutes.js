// connectionRoutes.js (Enhanced)
const express = require("express");
const connectionController = require("../controllers/connectionController");
const connectionRouter = express.Router();

// Existing routes
connectionRouter.get("/", connectionController.getConnections);
connectionRouter.post("/add", connectionController.addConnection);
connectionRouter.post("/edit/:id", connectionController.editConnection);
connectionRouter.delete("/delete/:id", connectionController.deleteConnection);
connectionRouter.post("/save-connections", connectionController.saveConnections);

// New route for testing connections
connectionRouter.post("/test/:id", connectionController.testConnection);

module.exports = connectionRouter;