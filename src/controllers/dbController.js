// dbController.js (Updated for singleton pattern)
const dbContext = require("../config/database-context"); // This is now a singleton instance

// Enhanced response helper
const sendResponse = (res, status, data, error = null) => {
  if (!res.headersSent) {
    res.status(status).json(error ? { error } : data);
  }
};

// Enhanced error handler
const handleError = (res, error, operation) => {
  console.error(`Error in ${operation}:`, error);
  
  if (error.message.includes("syntax error") || 
      error.code === "ER_PARSE_ERROR" ||
      error.sqlState === "42000" ||
      error.code === "42601" ||
      error.code === "ORA-00900" ||
      error.message.includes("SQLITE_ERROR")) {
    return sendResponse(res, 400, null, "SQL syntax error. Please check your query.");
  }
  
  if (error.code || error.sqlState || error.number) {
    return sendResponse(res, 400, null, `Database error: ${error.message}`);
  }
  
  sendResponse(res, 500, null, `Error ${operation}`);
};

// Get database type from headers
const getDbType = (req) => {
  return req.headers["x-db-type"] || req.headers["X-DB-Type"] || req.headers["X-Db-Type"];
};

const getDatabases = async (req, res) => {
  const dbType = getDbType(req);
  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }

  try {
    // Set strategy if needed (won't recreate if same type)
    dbContext.setStrategy(dbType);
    
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    
    const databaseStats = await dbContext.getDatabases();
    sendResponse(res, 200, { 
      databases: databaseStats,
      retrievedAt: new Date().toISOString()
    });
  } catch (err) {
    handleError(res, err, "fetching database stats");
  }
};

const getTables = async (req, res) => {
  const dbType = getDbType(req);
  const dbName = req.params.dbName;

  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }

  try {
    dbContext.setStrategy(dbType);
    
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.getStrategy().databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    
    const tables = await dbContext.getTables(dbName);
    sendResponse(res, 200, {
      tables,
      count: Array.isArray(tables) ? tables.length : 0,
      database: dbName,
      retrievedAt: new Date().toISOString()
    });
  } catch (err) {
    handleError(res, err, "fetching tables");
  }
};

const getTableInfo = async (req, res) => {
  const dbType = getDbType(req);
  const dbName = req.params.dbName;
  const table = req.params.table;

  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }

  try {
    dbContext.setStrategy(dbType);
    
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.getStrategy().databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    
    const tableInfo = await dbContext.getTableInfo(dbName, table);
    sendResponse(res, 200, {
      ...tableInfo,
      retrievedAt: new Date().toISOString()
    });
  } catch (err) {
    handleError(res, err, "fetching table stats");
  }
};

const getMultipleTablesInfo = async (req, res) => {
  const dbType = getDbType(req);
  const dbName = req.params.dbName;
  const { tables } = req.body;

  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }
  if (!dbName || !tables || !Array.isArray(tables) || tables.length === 0) {
    return sendResponse(res, 400, null, "Database name and tables array are required.");
  }

  try {
    dbContext.setStrategy(dbType);
    
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.getStrategy().databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    
    const tableDetails = await dbContext.getMultipleTablesInfo(dbName, tables);
    sendResponse(res, 200, { 
      tables: tableDetails,
      count: tableDetails.length,
      database: dbName,
      retrievedAt: new Date().toISOString()
    });
  } catch (err) {
    handleError(res, err, "fetching multiple table information");
  }
};

const executeQuery = async (req, res) => {
  const dbType = getDbType(req);
  const dbName = req.params.dbName;
  let { query, page = 1, pageSize = 10 } = req.body;

  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }
  if (!query || typeof query !== 'string') {
    return sendResponse(res, 400, null, "Query is required and must be a string");
  }

  page = Math.max(1, parseInt(page) || 1);
  pageSize = Math.min(Math.max(1, parseInt(pageSize) || 10), 1000);

  try {
    dbContext.setStrategy(dbType);
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }

    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.getStrategy().databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }

    const result = await dbContext.executeQuery(query, { page, pageSize, dbName });

    // NEW: pass through multi-query response when present
    if (result && Array.isArray(result.queries)) {
      return sendResponse(res, 200, {
        queries: result.queries,
        totalQueries: result.totalQueries,
        executedAt: result.executedAt
      });
    }

    // Backward-compat (if a strategy returns single shape)
    const response = {
      rows: result.rows || [],
      totalRows: result.totalRows || 0,
      messages: result.messages || [],
      pagination: {
        page,
        pageSize,
        totalPages: result.totalRows ? Math.ceil(result.totalRows / pageSize) : null,
        hasMore: result.totalRows ? (page * pageSize) < result.totalRows : false
      },
      executedAt: new Date().toISOString()
    };
    sendResponse(res, 200, response);
  } catch (err) {
    handleError(res, err, "executing query");
  }
};


const connect = async (req, res) => {
  console.log("Connect endpoint hit");
  console.log("Headers:", req.headers);
  
  const dbType = getDbType(req);
  const { username, password, host, port, dbType: bodyDbType, database, socketPath, ...sqliteConfig } = req.body;

  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }
  
  let requiredFields = ['dbType'];
  if (dbType !== 'sqlite3') {
    requiredFields = ['username', 'password', 'host', 'port', 'dbType'];
  } else {
    requiredFields.push('database');
  }
  
  const missingFields = requiredFields.filter(field => !req.body[field] && req.body[field] !== '');
  
  if (missingFields.length > 0) {
    return sendResponse(res, 400, null, `Missing required fields: ${missingFields.join(', ')}`);
  }
  
  if (dbType !== bodyDbType) {
    return sendResponse(res, 400, null, "dbType in body must match x-db-type in headers");
  }

  console.log(`> Attempting to connect to ${dbType} ${dbType === 'sqlite3' ? `database: ${database}` : `server @ ${host}:${port} with user ${username}`}`);
  
  try {
    const config = dbType === 'sqlite3' 
      ? { dbType, database, ...sqliteConfig }
      : { username, password, host, port, dbType, database, socketPath };
    await dbContext.connect(config);
    
    sendResponse(res, 200, { 
      message: `Connected to ${dbType} ${dbType === 'sqlite3' ? `database: ${database}` : `server @ ${host}:${port}`}`,
      timestamp: new Date().toISOString(),
      database: database || 'default'
    });
  } catch (err) {
    handleError(res, err, "connecting to database");
  }
};

const switchDatabase = async (req, res) => {
  const dbType = getDbType(req);
  const { dbName } = req.body;

  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }
  if (!dbName) {
    return sendResponse(res, 400, null, "Database name is required");
  }

  try {
    dbContext.setStrategy(dbType);
    
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }
    
    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    } else if (dbName !== dbContext.getStrategy().databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    
    sendResponse(res, 200, { 
      message: `Switched to database ${dbName}`,
      database: dbName,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    handleError(res, err, "switching database");
  }
};

const executeBatch = async (req, res) => {
  const dbType = getDbType(req);
  const dbName = req.params.dbName;
  const { queries } = req.body;

  if (!dbType) {
    return sendResponse(res, 400, null, "Database type (x-db-type) must be specified in headers");
  }
  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    return sendResponse(res, 400, null, "Queries array is required and must not be empty");
  }

  try {
    dbContext.setStrategy(dbType);
    
    if (!(await dbContext.validateConnection())) {
      throw new Error("No active database connection. Call connect first.");
    }

    if (dbType !== "sqlite3") {
      await dbContext.switchDatabase(dbName);
    }

    const results = [];
    for (const query of queries) {
      const result = await dbContext.executeQuery(query, { dbName });
      results.push(result);
    }

    sendResponse(res, 200, {
      results,
      totalQueries: queries.length,
      executedAt: new Date().toISOString(),
      mode: 'batch'
    });
  } catch (err) {
    handleError(res, err, "executing batch");
  }
};

const getConnectionHealth = async (req, res) => {
  try {
    const isHealthy = await dbContext.validateConnection();
    sendResponse(res, 200, {
      status: isHealthy ? 'healthy' : 'unhealthy',
      connected: dbContext.isConnectionActive(),
      dbType: dbContext.getCurrentDbType(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    sendResponse(res, 200, {
      status: 'unhealthy',
      connected: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

const analyzeQuery = async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return sendResponse(res, 400, null, "Query is required");
  }

  try {
    const trimmedQuery = query.trim().toUpperCase();
    const isSelect = trimmedQuery.startsWith('SELECT');
    const isReadOnly = /^(SELECT|SHOW|DESCRIBE|EXPLAIN)\s/i.test(trimmedQuery);
    
    const analysis = {
      type: isSelect ? 'SELECT' : 'OTHER',
      isReadOnly,
      requiresTransaction: !isReadOnly,
      supportsPagination: isSelect,
      queryLength: query.length
    };

    sendResponse(res, 200, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      analysis,
      analyzedAt: new Date().toISOString()
    });
  } catch (err) {
    handleError(res, err, "analyzing query");
  }
};

const getViews = async (req, res) => {
  sendResponse(res, 501, null, "Views endpoint not implemented yet");
};

const getProcedures = async (req, res) => {
  sendResponse(res, 501, null, "Procedures endpoint not implemented yet");
};

module.exports = {
  getDatabases,
  getTables,
  getTableInfo,
  executeQuery,
  getMultipleTablesInfo,
  connect,
  switchDatabase,
  executeBatch,
  getConnectionHealth,
  analyzeQuery,
  getViews,
  getProcedures
};