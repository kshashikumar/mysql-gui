const DatabaseContext = require("../config/database-context");
const dbContext = new DatabaseContext();

const getDatabases = async (req, res) => {
  const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"];
  if (!dbType) {
    return res.status(400).json({ error: "Database type (x-db-type) must be specified in headers" });
  }

  try {
    dbContext.setStrategy(dbType);
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    const databaseStats = await dbContext.getDatabases();
    if (!res.headersSent) {
      res.status(200).json({ databases: databaseStats });
    }
  } catch (err) {
    console.error("Error fetching database stats:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error fetching database stats" });
    }
  }
};

const getTables = async (req, res) => {
  const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"] || req.headers["X-Db-Type"];
  const dbName = req.params.dbName;

  if (!dbType) {
    return res.status(400).json({ error: "Database type (x-db-type) must be specified in headers" });
  }

  try {
    dbContext.setStrategy(dbType);
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.strategy.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    const tables = await dbContext.getTables(dbName);
    if (!res.headersSent) {
      res.status(200).json(tables);
    }
  } catch (err) {
    console.error("Error fetching tables:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error fetching tables" });
    }
  }
};

const getTableInfo = async (req, res) => {
  const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"];
  const dbName = req.params.dbName;
  const table = req.params.table;

  if (!dbType) {
    return res.status(400).json({ error: "Database type (x-db-type) must be specified in headers" });
  }

  try {
    dbContext.setStrategy(dbType);
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.strategy.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    const tableInfo = await dbContext.getTableInfo(dbName, table);
    if (!res.headersSent) {
      res.status(200).json(tableInfo);
    }
  } catch (err) {
    console.error("Error fetching table stats:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error fetching table stats" });
    }
  }
};

const getMultipleTablesInfo = async (req, res) => {
  const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"];
  const dbName = req.params.dbName;
  const { tables } = req.body;

  if (!dbType) {
    return res.status(400).json({ error: "Database type (x-db-type) must be specified in headers" });
  }
  if (!dbName || !tables || !Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ error: "Database name and tables array are required." });
  }

  try {
    dbContext.setStrategy(dbType);
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.strategy.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    const tableDetails = await dbContext.getMultipleTablesInfo(dbName, tables);
    if (!res.headersSent) {
      res.status(200).json({ tables: tableDetails });
    }
  } catch (err) {
    console.error("Error fetching multiple table stats:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "An error occurred while fetching table information." });
    }
  }
};

const executeQuery = async (req, res) => {
  const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"];
  const dbName = req.params.dbName;
  let { query, page = 1, pageSize = 10 } = req.body;

  if (!dbType) {
    return res.status(400).json({ error: "Database type (x-db-type) must be specified in headers" });
  }

  try {
    dbContext.setStrategy(dbType);
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }

    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.strategy.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }

    const { rows, totalRows, messages } = await dbContext.executeQuery(query, { page, pageSize, dbName });
    if (!res.headersSent) {
      res.status(200).json({ rows, totalRows, messages });
    }
  } catch (err) {
    console.error("Error executing query:", err);
    if (
      err.message.includes("SQL syntax error") ||
      err.code === "ER_PARSE_ERROR" ||
      err.sqlState === "42000" ||
      err.code === "42601" || // PostgreSQL syntax error
      err.code === "ORA-00900" || // Oracle syntax error
      err.message.includes("SQLITE_ERROR")
    ) {
      if (!res.headersSent) {
        res.status(400).json({ error: "SQL syntax error. Please check your query." });
      }
    } else if (err.code || err.sqlState || err.number) {
      if (!res.headersSent) {
        res.status(400).json({ error: `Database error: ${err.message}` });
      }
    } else {
      if (!res.headersSent) {
        res.status(500).json({ error: "Error executing query." });
      }
    }
  }
};

const connect = async (req, res) => {
  console.log("Connect endpoint hit");
  console.log("Headers:", req.headers);
  const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"] || req.headers["X-Db-Type"];
  const { username, password, host, port, dbType: bodyDbType, database, socketPath } = req.body;

  if (!dbType) {
    return res.status(400).json({ error: "Database type (x-db-type) must be specified in headers" });
  }
  if (!username || !password || !host || !port || !bodyDbType) {
    return res.status(400).json({ error: "Missing required connection parameters" });
  }
  if (dbType !== bodyDbType) {
    return res.status(400).json({ error: "dbType in body must match x-db-type in headers" });
  }

  console.log(`> Attempting to connect to ${dbType} server @ ${host}:${port} with user ${username}`);
  try {
    dbContext.setStrategy(dbType);
    console.log("Setting strategy to:", dbType);
    await dbContext.connect({ username, password, host, port, dbType, database, socketPath });
    res.status(200).json({ message: `Connected to ${dbType} server @ ${host}:${port}` });
  } catch (err) {
    console.error("Error connecting to database:", err);
    res.status(500).json({ error: "Error connecting to database" });
  }
};

const switchDatabase = async (req, res) => {
  const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"];
  const { dbName } = req.body;

  if (!dbType) {
    return res.status(400).json({ error: "Database type (x-db-type) must be specified in headers" });
  }
  if (!dbName) {
    return res.status(400).json({ error: "Database name is required" });
  }

  try {
    dbContext.setStrategy(dbType);
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.strategy.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    res.status(200).json({ message: `Switched to database ${dbName}` });
  } catch (err) {
    console.error("Error switching database:", err);
    res.status(500).json({ error: "Error switching database" });
  }
};

module.exports = {
  getDatabases,
  getTables,
  getTableInfo,
  executeQuery,
  getMultipleTablesInfo,
  connect,
  switchDatabase
};
