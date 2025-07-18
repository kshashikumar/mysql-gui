const express = require("express");
const dbController = require("../controllers/dbController");
const dbRouter = express.Router();

dbRouter.post("/connect", dbController.connect);
dbRouter.post("/switch-database", dbController.switchDatabase);
dbRouter.post("/:dbName/query", dbController.executeQuery);
dbRouter.get("/databases", dbController.getDatabases);
dbRouter.get("/:dbName/tables", dbController.getTables);
dbRouter.get("/:dbName/:table/info", dbController.getTableInfo);
dbRouter.post("/:dbName/info", dbController.getMultipleTablesInfo);

module.exports = dbRouter;
