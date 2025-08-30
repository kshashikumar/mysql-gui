// mysql-strategy.js (Enhanced with all optional parameters)
const mysql = require("mysql2/promise");
const DatabaseStrategy = require("../database-strategy");

class MySQLStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.pool = null;
  }

  async connect(config) {
    const { 
      host, 
      port, 
      username, 
      password, 
      database, 
      socketPath,
      ssl,
      connectionTimeout,
      poolSize,
      charset,
      timezone,
      acquireTimeout,
      waitForConnections,
      queueLimit,
      reconnect,
      idleTimeout
    } = config;

    console.log(
      `> Connecting to MySQL server @ ${host || "localhost"}:${port || 3306} with user ${username}${
        database ? ` and database ${database}` : ""
      }${socketPath ? ` using socket ${socketPath}` : ""}${ssl ? " with SSL" : ""}`
    );

    // Build connection configuration with all optional parameters
    const connectionConfig = {
      host: host || "localhost",
      port: host === "localhost" && !port ? undefined : parseInt(port) || 3306,
      user: username,
      password,
      database: database || undefined,
      socketPath: host === "localhost" && socketPath ? socketPath : undefined,
      
      // SSL Configuration
      ssl: ssl ? (typeof ssl === 'object' ? ssl : { rejectUnauthorized: false }) : 
           (host !== "localhost" ? { rejectUnauthorized: false } : undefined),
      
      // Pool Configuration
      connectionLimit: parseInt(poolSize) || 10,
      acquireTimeout: parseInt(acquireTimeout) || parseInt(connectionTimeout) || 60000,
      waitForConnections: waitForConnections !== undefined ? waitForConnections : true,
      queueLimit: parseInt(queueLimit) || 0,
      
      // Connection Options
      charset: charset || 'UTF8_GENERAL_CI',
      timezone: timezone || 'local',
      reconnect: reconnect !== undefined ? reconnect : true,
      
      // Timeouts
      connectTimeout: parseInt(connectionTimeout) || 60000,
      timeout: parseInt(connectionTimeout) || 60000,
      idleTimeout: parseInt(idleTimeout) || 30000,
      
      // Additional MySQL specific options
      multipleStatements: true,
      dateStrings: false,
      debug: false,
      trace: true,
      stringifyObjects: false,
      supportBigNumbers: true,
      bigNumberStrings: false,
      
      // Performance options
      typeCast: true,
      nestTables: false,
      rowsAsArray: false
    };

    // Remove undefined values to avoid mysql2 warnings
    Object.keys(connectionConfig).forEach(key => {
      if (connectionConfig[key] === undefined) {
        delete connectionConfig[key];
      }
    });

    this.pool = await mysql.createPool(connectionConfig);

    // Test connection
    await this.pool.query("SELECT 1");
    console.log("> Successfully connected to MySQL server");
  }

  async switchDatabase(dbName) {
    if (!this.pool) throw new Error("MySQL connection not initialized");
    await this.pool.query(`USE \`${dbName}\``);
    console.log(`> Switched to MySQL database: ${dbName}`);
  }

  async executeQuery(query, options = { page: 1, pageSize: 10 }) {
  if (!this.pool) throw new Error("MySQL connection not initialized");
  const { page, pageSize } = options;

  const queries = [];
  const statements = query
    .split(";")
    .map((q) => q.trim())
    .filter((q) => q);

  for (const singleQuery of statements) {
    const isSelectQuery = /^SELECT\s/i.test(singleQuery);
    const isShowCommand = /^SHOW\s/i.test(singleQuery);
    const isDescribeCommand = /^DESCRIBE\s/i.test(singleQuery);
    const isInsertCommand = /^INSERT\s/i.test(singleQuery);
    const isUpdateCommand = /^UPDATE\s/i.test(singleQuery);
    const isDeleteCommand = /^DELETE\s/i.test(singleQuery);
    const isCreateCommand = /^CREATE\s/i.test(singleQuery);
    const isDropCommand = /^DROP\s/i.test(singleQuery);
    const isAlterCommand = /^ALTER\s/i.test(singleQuery);
    const isGrantCommand = /^GRANT\s/i.test(singleQuery);
    const isRevokeCommand = /^REVOKE\s/i.test(singleQuery);
    const isTransactionCommand = /^(BEGIN|START|COMMIT|ROLLBACK)\b/i.test(singleQuery);

    if (isSelectQuery) {
      const hasLimitOrOffset =
        /LIMIT\s+\d+/i.test(singleQuery) || /OFFSET\s+\d+/i.test(singleQuery);

      // Apply pagination only if user didn't specify LIMIT/OFFSET
      let paginatedQuery = singleQuery;
      if (!hasLimitOrOffset) {
        const offset = (page - 1) * pageSize;
        paginatedQuery = `${singleQuery} LIMIT ${pageSize} OFFSET ${offset}`;
      }

      const [rows] = await this.pool.query(paginatedQuery);

      let totalRows = rows.length;
      if (!hasLimitOrOffset) {
        const totalRowsQuery = `SELECT COUNT(*) as count FROM (${singleQuery}) as subquery`;
        const [countRows] = await this.pool.query(totalRowsQuery);
        totalRows = countRows[0]?.count ?? 0;
      }

      const totalPages = hasLimitOrOffset
        ? Math.ceil(totalRows / pageSize) || 1
        : Math.ceil(totalRows / pageSize) || 1;

      queries.push({
        type: "SELECT",
        query: singleQuery,
        rows,
        totalRows,
        messages: [],
        pagination: {
          page,
          pageSize,
          totalPages,
          hasMore: page * pageSize < totalRows
        }
      });
    } else if (isShowCommand || isDescribeCommand) {
      const [rows] = await this.pool.query(singleQuery);
      queries.push({
        type: isShowCommand ? "SHOW" : "DESCRIBE",
        query: singleQuery,
        rows,
        totalRows: rows.length,
        messages: [{ query: singleQuery, message: "Database command executed successfully", type: isShowCommand ? "SHOW" : "DESCRIBE" }],
        pagination: { page: 1, pageSize: rows.length || 1, totalPages: 1, hasMore: false }
      });
    } else if (isInsertCommand || isUpdateCommand || isDeleteCommand || isCreateCommand || isDropCommand || isAlterCommand) {
      const [response] = await this.pool.query(singleQuery);
      const type = isInsertCommand ? "INSERT" :
                   isUpdateCommand ? "UPDATE" :
                   isDeleteCommand ? "DELETE" :
                   isCreateCommand ? "CREATE" :
                   isDropCommand ? "DROP" : "ALTER";

      queries.push({
        type,
        query: singleQuery,
        rows: [],
        totalRows: 0,
        messages: [{
          query: singleQuery,
          message: "Command executed successfully",
          type,
          affectedRows: response.affectedRows || 0,
          insertId: response.insertId || null,
          warningCount: response.warningCount || 0
        }],
        pagination: { page: 1, pageSize: 0, totalPages: 1, hasMore: false }
      });
    } else if (isGrantCommand || isRevokeCommand || isTransactionCommand) {
      await this.pool.query(singleQuery);
      const type = isGrantCommand ? "GRANT" : isRevokeCommand ? "REVOKE" : "TRANSACTION";
      queries.push({
        type,
        query: singleQuery,
        rows: [],
        totalRows: 0,
        messages: [{ query: singleQuery, message: `${type} command executed successfully`, type }],
        pagination: { page: 1, pageSize: 0, totalPages: 1, hasMore: false }
      });
    } else {
      queries.push({
        type: "UNKNOWN",
        query: singleQuery,
        rows: [],
        totalRows: 0,
        messages: [{ query: singleQuery, message: "Command not recognized or unsupported", type: "UNKNOWN" }],
        pagination: { page: 1, pageSize: 0, totalPages: 1, hasMore: false }
      });
    }
  }

  return {
    queries,
    totalQueries: queries.length,
    executedAt: new Date().toISOString()
  };
}



  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      console.log("> Disconnected from MySQL database");
      this.pool = null;
    }
  }

  async validateConnection() {
    if (!this.pool) return false;
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch (err) {
      console.error("MySQL connection validation failed:", err);
      return false;
    }
  }

  // Get connection pool statistics
  async getConnectionStats() {
    if (!this.pool) return null;
    
    try {
      const [stats] = await this.pool.query(`
        SHOW STATUS WHERE Variable_name IN (
          'Connections',
          'Max_used_connections',
          'Threads_connected',
          'Threads_running',
          'Uptime'
        )
      `);
      
      return stats.reduce((acc, stat) => {
        acc[stat.Variable_name] = stat.Value;
        return acc;
      }, {});
    } catch (err) {
      console.error("Error getting connection stats:", err);
      return null;
    }
  }

  async getDatabases() {
    if (!this.pool) throw new Error("MySQL connection not initialized");
    const [databases] = await this.pool.query("SELECT SCHEMA_NAME AS name FROM INFORMATION_SCHEMA.SCHEMATA");
    const databaseStats = [];

    for (const db of databases) {
      const dbName = db.name;
      const [sizeData] = await this.pool.query(
        `SELECT SUM(DATA_LENGTH + INDEX_LENGTH) AS sizeOnDisk 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ?`,
        [dbName]
      );
      const sizeOnDisk = sizeData[0].sizeOnDisk || 0;

      const [tables] = await this.pool.query(
        `SELECT TABLE_NAME AS table_name 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ?`,
        [dbName]
      );

      const [views] = await this.pool.query(
        `SELECT TABLE_NAME AS view_name 
         FROM INFORMATION_SCHEMA.VIEWS 
         WHERE TABLE_SCHEMA = ?`,
        [dbName]
      );

      const tablesData = tables.map((table) => ({ name: table.table_name }));
      const viewsData = views.map((view) => ({ name: view.view_name }));

      databaseStats.push({
        name: dbName,
        sizeOnDisk,
        tables: tablesData,
        views: viewsData,
      });
    }

    return databaseStats;
  }

  async getTables(dbName) {
    if (!this.pool) throw new Error("MySQL connection not initialized");
    await this.switchDatabase(dbName);
    const [tables] = await this.pool.query(
      `SELECT TABLE_NAME AS table_name 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ?`,
      [dbName]
    );
    return tables.map((table) => table.table_name);
  }

  async getTableInfo(dbName, tableName) {
  if (!this.pool) throw new Error("MySQL connection not initialized");
  
  // Switch to database first
  await this.pool.query(`USE \`${dbName}\``);
  
  // Get columns
  const [columns] = await this.pool.query(
    `SELECT COLUMN_NAME as column_name, 
            DATA_TYPE as data_type, 
            IS_NULLABLE as is_nullable, 
            COLUMN_DEFAULT as column_default,
            EXTRA as extra,
            COLUMN_KEY as column_key
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
     ORDER BY ORDINAL_POSITION`,
    [dbName, tableName]
  );
  
  // Get indexes
  const [indexes] = await this.pool.query(
    `SELECT INDEX_NAME as index_name, 
            NON_UNIQUE as non_unique, 
            COLUMN_NAME as column_name,
            INDEX_TYPE as index_type
     FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [dbName, tableName]
  );
  
  // Get foreign keys
  const [foreignKeys] = await this.pool.query(
    `SELECT CONSTRAINT_NAME as fk_name,
            COLUMN_NAME as column_name,
            REFERENCED_TABLE_SCHEMA as referenced_schema,
            REFERENCED_TABLE_NAME as referenced_table,
            REFERENCED_COLUMN_NAME as referenced_column
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
     AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [dbName, tableName]
  );
  
  // Get triggers - Use version-compatible query
  let triggers = [];
  try {
    // Try the new format first (MySQL 5.7+)
    const [triggersResult] = await this.pool.query(
      `SELECT TRIGGER_NAME AS trigger_name, 
              EVENT_MANIPULATION as event_manipulation, 
              ACTION_TIMING as action_timing,
              ACTION_STATEMENT as action_statement
       FROM INFORMATION_SCHEMA.TRIGGERS 
       WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?`,
      [dbName, tableName]
    );
    triggers = triggersResult;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      // Fallback for older MySQL versions - try without TIMING/ACTION_TIMING
      try {
        const [triggersResult] = await this.pool.query(
          `SELECT TRIGGER_NAME AS trigger_name, 
                  EVENT_MANIPULATION as event_manipulation,
                  ACTION_STATEMENT as action_statement
           FROM INFORMATION_SCHEMA.TRIGGERS 
           WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?`,
          [dbName, tableName]
        );
        triggers = triggersResult.map(trigger => ({
          ...trigger,
          action_timing: 'UNKNOWN' // Default value for missing column
        }));
      } catch (fallbackErr) {
        // If triggers table doesn't exist or has other issues, return empty array
        console.warn(`Could not fetch triggers for ${dbName}.${tableName}:`, fallbackErr.message);
        triggers = [];
      }
    } else {
      throw err; // Re-throw if it's a different error
    }
  }

  return {
    db_name: dbName,
    table_name: tableName,
    columns: columns.map((col) => ({
      column_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable === 'YES',
      default_value: col.column_default,
      extra: col.extra,
      is_primary_key: col.column_key === 'PRI'
    })),
    indexes: indexes.map((idx) => ({
      index_name: idx.index_name,
      is_unique: idx.non_unique === 0,
      column_name: idx.column_name,
      index_type: idx.index_type
    })),
    foreign_keys: foreignKeys.map((fk) => ({
      fk_name: fk.fk_name,
      column_name: fk.column_name,
      referenced_schema: fk.referenced_schema,
      referenced_table: fk.referenced_table,
      referenced_column: fk.referenced_column
    })),
    triggers: triggers.map((trig) => ({
      trigger_name: trig.trigger_name,
      event_manipulation: trig.event_manipulation,
      action_timing: trig.action_timing || 'UNKNOWN',
      action_statement: trig.action_statement
    })),
  };
}

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.pool) throw new Error("MySQL connection not initialized");
    await this.switchDatabase(dbName);
    const tableDetails = [];

    for (const table of tableNames) {
      const tableInfo = await this.getTableInfo(dbName, table);
      tableDetails.push(tableInfo);
    }

    return tableDetails;
  }
}

module.exports = MySQLStrategy;