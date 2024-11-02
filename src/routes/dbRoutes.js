const express = require("express");
const dbController = require("../controllers/dbController");
const dbRouter = express.Router();

dbRouter.get("/databases", dbController.getDatabases);
dbRouter.get("/databaseNames", dbController.getDatabaseNames);
dbRouter.get("/database/:dbName/tables", dbController.getTables);
dbRouter.get("/database/:dbName/tables/:tableName/columns", dbController.getColumns);
dbRouter.get("/database/:dbName/views", dbController.getViews);
dbRouter.get("/database/:dbName/procedures", dbController.getProcedures);
dbRouter.get("/database/:dbName/functions", dbController.getFunctions);
dbRouter.post("/database/:dbName/execute-query", dbController.executeQuery);

module.exports = dbRouter;
