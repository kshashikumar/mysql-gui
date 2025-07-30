// dbRoutes.js (Enhanced)
const express = require("express");
const dbController = require("../controllers/dbController");
const dbRouter = express.Router();

// Middleware to validate database type header
const validateDbType = (req, res, next) => {
  const dbType = req.headers["x-db-type"] || 
                 req.headers["X-DB-Type"] || 
                 req.headers["X-Db-Type"];
  
  if (!dbType) {
    return res.status(400).json({ 
      error: "Database type (x-db-type) must be specified in headers" 
    });
  }
  
  req.dbType = dbType;
  next();
};

// Apply database type validation middleware to routes that need it
const validateDbTypeRoutes = [
  "/connect",
  "/switch-database", 
  "/databases",
  "/:dbName/query",
  "/:dbName/batch",
  "/:dbName/tables",
  "/:dbName/views", 
  "/:dbName/procedures",
  "/:dbName/:table/info",
  "/:dbName/info"
];

validateDbTypeRoutes.forEach(route => {
  dbRouter.use(route, validateDbType);
});

// Connection management routes
dbRouter.post("/connect", dbController.connect);
dbRouter.post("/switch-database", dbController.switchDatabase);
dbRouter.get("/health", dbController.getConnectionHealth || ((req, res) => {
  res.status(200).json({ message: "Health endpoint not implemented yet" });
}));

// Query execution routes
dbRouter.post("/:dbName/query", dbController.executeQuery);
dbRouter.post("/:dbName/batch", dbController.executeBatch || ((req, res) => {
  res.status(501).json({ error: "Batch execution not implemented yet" });
}));
dbRouter.post("/analyze-query", dbController.analyzeQuery || ((req, res) => {
  res.status(501).json({ error: "Query analysis not implemented yet" });
}));

// Database information routes
dbRouter.get("/databases", dbController.getDatabases);
dbRouter.get("/:dbName/tables", dbController.getTables);
dbRouter.get("/:dbName/views", dbController.getViews || ((req, res) => {
  res.status(501).json({ error: "Views endpoint not implemented yet" });
}));
dbRouter.get("/:dbName/procedures", dbController.getProcedures || ((req, res) => {
  res.status(501).json({ error: "Procedures endpoint not implemented yet" });
}));

// Table information routes  
dbRouter.get("/:dbName/:table/info", dbController.getTableInfo);
dbRouter.post("/:dbName/info", dbController.getMultipleTablesInfo);

module.exports = dbRouter;