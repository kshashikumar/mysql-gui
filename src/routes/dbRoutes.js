const express = require("express");
const dbController = require("../controllers/dbController");
const dbRouter = express.Router();

dbRouter.get("/databases", dbController.getDatabases);
dbRouter.get("/database/:dbName/:table/info", dbController.getTableInfo);
dbRouter.post("/database/:dbName/info", dbController.getMultipleTablesInfo);
dbRouter.post("/database/:dbName/execute-query", dbController.executeQuery);
dbRouter.get("/connections", dbController.getConnections);

module.exports = dbRouter;
