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

// Structure / DDL (Phase 2)
dbRouter.post("/database", dbController.createDatabase);
dbRouter.delete("/database/:dbName", dbController.dropDatabase);
dbRouter.post("/database/:dbName/table", dbController.createTable);
dbRouter.delete("/database/:dbName/table/:table", dbController.dropTable);
dbRouter.patch("/database/:dbName/table/:table/rename", dbController.renameTable);
dbRouter.post(
  "/database/:dbName/table/:table/truncate",
  dbController.truncateTable
);
dbRouter.post(
  "/database/:dbName/table/:table/column",
  dbController.addColumn
);
dbRouter.delete(
  "/database/:dbName/table/:table/column/:column",
  dbController.dropColumn
);
dbRouter.patch(
  "/database/:dbName/table/:table/column/:column",
  dbController.modifyColumn
);

module.exports = dbRouter;
