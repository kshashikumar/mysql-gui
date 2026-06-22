const express = require("express");
const dbController = require("../controllers/dbController");
const dbRouter = express.Router();

dbRouter.get("/databases", dbController.getDatabases);
dbRouter.get("/database/:dbName/:table/info", dbController.getTableInfo);
dbRouter.post("/database/:dbName/info", dbController.getMultipleTablesInfo);
dbRouter.post("/database/:dbName/execute-query", dbController.executeQuery);

// Row CRUD (Phase 1)
dbRouter.post("/database/:dbName/row/insert", dbController.insertRow);
dbRouter.put("/database/:dbName/row/update", dbController.updateRow);
dbRouter.delete("/database/:dbName/row/delete", dbController.deleteRow);

module.exports = dbRouter;
