// mssql-strategy.js (Enhanced with optional parameters)
const mssql = require("mssql");
const DatabaseStrategy = require("../database-strategy");

class MSSQLStrategy extends DatabaseStrategy {
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
      ssl,
      connectionTimeout,
      poolSize,
      encrypt,
      trustServerCertificate,
      instanceName,
      domain,
      requestTimeout,
      cancelTimeout,
      packetSize,
      appName
    } = config;

    console.log(
      `> Connecting to MSSQL server @ ${host || "localhost"}:${port || 1433} with user ${username}${
        database ? ` and database ${database}` : ""
      }${instanceName ? ` instance ${instanceName}` : ""}${encrypt || ssl ? " with encryption" : ""}`
    );

    // Build connection configuration with optional parameters
    const connectionConfig = {
      server: host || "localhost",
      port: parseInt(port) || 1433,
      user: username,
      password,
      database: database || "master",
      
      // Pool configuration
      pool: { 
        max: parseInt(poolSize) || 10, 
        min: 2, 
        idleTimeoutMillis: 30000 
      },
      
      // Security options
      options: { 
        encrypt: encrypt !== undefined ? encrypt : (ssl || true),
        trustServerCertificate: trustServerCertificate !== undefined ? trustServerCertificate : true,
        enableArithAbort: true,
        instanceName: instanceName || undefined,
        packetSize: parseInt(packetSize) || undefined,
        appName: appName || 'dbfuse-ai-App'
      },
      
      // Timeout configuration
      connectionTimeout: parseInt(connectionTimeout) || 60000,
      requestTimeout: parseInt(requestTimeout) || 30000,
      cancelTimeout: parseInt(cancelTimeout) || 5000,
      
      // Domain authentication
      domain: domain || undefined,
      
      // Connection retry
      parseJSON: true,
      
      // Additional options
      arrayRowMode: false,
      useUTC: true
    };

    // Remove undefined values
    Object.keys(connectionConfig.options).forEach(key => {
      if (connectionConfig.options[key] === undefined) {
        delete connectionConfig.options[key];
      }
    });

    if (!connectionConfig.domain) delete connectionConfig.domain;

    this.pool = new mssql.ConnectionPool(connectionConfig);

    await this.pool.connect();
    await this.pool.request().query("SELECT 1");
    console.log("> Successfully connected to MSSQL server");
  }

  async switchDatabase(dbName) {
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    await this.pool.request().query(`USE [${dbName}]`);
    console.log(`> Switched to MSSQL database: ${dbName}`);
  }

  async executeQuery(query, options = { page: 1, pageSize: 10 }) {
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    const { page, pageSize, dbName } = options;
    let result = [];
    let totalRows = null;
    let messages = [];

    const queries = query
      .split(";")
      .map((q) => q.trim())
      .filter((q) => q);

    for (const singleQuery of queries) {
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
      const isTransactionCommand = /^BEGIN\s|^START\s|^COMMIT\s|^ROLLBACK\s/i.test(singleQuery);

      if (isSelectQuery) {
        let paginatedQuery = singleQuery;
        const hasLimitOrOffset = /OFFSET\s+\d+/i.test(singleQuery);
        if (!hasLimitOrOffset && page && pageSize) {
          const offset = (page - 1) * pageSize;
          // Check if query already has ORDER BY, if not add one
          if (!/ORDER\s+BY/i.test(singleQuery)) {
            paginatedQuery = `${singleQuery} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
          } else {
            paginatedQuery = `${singleQuery} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
          }
        }
        const { recordset } = await this.pool.request().query(paginatedQuery);
        result.push(...recordset);

        if (totalRows === null) {
          const totalRowsQuery = `SELECT COUNT(*) as count FROM (${singleQuery}) as subquery`;
          const { recordset: countRows } = await this.pool.request().query(totalRowsQuery);
          totalRows = countRows[0].count;
        }
      } else if (isShowCommand || isDescribeCommand) {
        let recordset;
        if (isShowCommand && /SHOW\s+TABLES/i.test(singleQuery)) {
          const currentDb = dbName || 'master';
          recordset = (await this.pool.request().query(`SELECT name AS table_name FROM ${currentDb}.sys.tables`)).recordset;
        } else if (isDescribeCommand) {
          const tableName = singleQuery.match(/DESCRIBE\s+(\w+)/i)?.[1];
          if (tableName) {
            const currentDb = dbName || 'master';
            recordset = (
              await this.pool.request().query(
                `SELECT column_name, data_type FROM ${currentDb}.information_schema.columns WHERE table_name = '${tableName}'`
              )
            ).recordset;
          }
        }
        if (recordset) {
          result.push(...recordset);
          messages.push({ query: singleQuery, message: "Database command executed successfully" });
        }
      } else if (isInsertCommand || isUpdateCommand || isDeleteCommand || isCreateCommand || isDropCommand || isAlterCommand) {
        const { rowsAffected } = await this.pool.request().query(singleQuery);
        messages.push({
          query: singleQuery,
          message: "Command executed successfully",
          affectedRows: rowsAffected[0] || 0,
        });
      }  else if (isGrantCommand || isRevokeCommand || isTransactionCommand) {
        // Don't modify transaction commands - use them as-is
        await this.pool.request().query(singleQuery);
        messages.push({ 
          query: singleQuery, 
          message: `${isGrantCommand || isRevokeCommand ? "Permission" : "Transaction"} command executed successfully` 
        });
      } else {
        messages.push({ query: singleQuery, message: "Command not recognized or unsupported" });
      }
    }

    return { rows: result, totalRows, messages };
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      console.log("> Disconnected from MSSQL database");
      this.pool = null;
    }
  }

  async validateConnection() {
    if (!this.pool) return false;
    try {
      await this.pool.request().query("SELECT 1");
      return true;
    } catch (err) {
      console.error("MSSQL connection validation failed:", err);
      return false;
    }
  }

  // Get connection pool statistics
  async getConnectionStats() {
    if (!this.pool) return null;
    
    try {
      const { recordset } = await this.pool.request().query(`
        SELECT 
          COUNT(*) as total_connections,
          SUM(CASE WHEN session_id > 0 THEN 1 ELSE 0 END) as active_connections
        FROM sys.dm_exec_sessions 
        WHERE is_user_process = 1
      `);
      
      return {
        totalConnections: recordset[0].total_connections,
        activeConnections: recordset[0].active_connections,
        poolConnected: this.pool.connected,
        poolConnecting: this.pool.connecting
      };
    } catch (err) {
      console.error("Error getting connection stats:", err);
      return null;
    }
  }

  async getDatabases() {
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    const { recordset: databases } = await this.pool.request().query("SELECT name FROM sys.databases");
    const databaseStats = [];

    for (const db of databases) {
      const dbName = db.name;
      try {
        const { recordset: sizeData } = await this.pool.request().query(
          `SELECT SUM(size) * 8.0 * 1024 AS sizeOnDisk 
           FROM ${dbName}.sys.master_files 
           WHERE database_id = DB_ID('${dbName}')`
        );
        const sizeOnDisk = sizeData[0]?.sizeOnDisk || 0;

        const { recordset: tables } = await this.pool.request().query(
          `SELECT name AS table_name 
           FROM ${dbName}.sys.tables`
        );

        const { recordset: views } = await this.pool.request().query(
          `SELECT name AS view_name 
           FROM ${dbName}.sys.views`
        );

        const tablesData = tables.map((table) => ({ name: table.table_name }));
        const viewsData = views.map((view) => ({ name: view.view_name }));

        databaseStats.push({
          name: dbName,
          sizeOnDisk,
          tables: tablesData,
          views: viewsData,
        });
      } catch (err) {
        // Skip databases we can't access
        console.warn(`Cannot access database ${dbName}: ${err.message}`);
        databaseStats.push({
          name: dbName,
          sizeOnDisk: 0,
          tables: [],
          views: [],
          error: "Access denied"
        });
      }
    }

    return databaseStats;
  }

  async getTables(dbName) {
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    await this.switchDatabase(dbName);
    const { recordset } = await this.pool.request().query(
      `SELECT name AS table_name 
       FROM ${dbName}.sys.tables`
    );
    return recordset.map((row) => row.table_name);
  }

  async getTableInfo(dbName, tableName) {
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    await this.switchDatabase(dbName);
    
    const request = this.pool.request();
    request.input('tableName', mssql.NVarChar, tableName);
    
    const { recordset: columns } = await request.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM ${dbName}.information_schema.columns 
       WHERE table_name = @tableName
       ORDER BY ordinal_position`
    );
    
    const { recordset: indexes } = await this.pool.request().query(
      `SELECT name AS index_name, is_unique, type_desc
       FROM ${dbName}.sys.indexes 
       WHERE object_id = OBJECT_ID('${dbName}.dbo.${tableName}')`
    );
    
    const { recordset: foreignKeys } = await this.pool.request().query(
      `SELECT name AS fk_name, 
              OBJECT_NAME(parent_object_id) as table_name,
              OBJECT_NAME(referenced_object_id) as referenced_table
       FROM ${dbName}.sys.foreign_keys 
       WHERE parent_object_id = OBJECT_ID('${dbName}.dbo.${tableName}')`
    );
    
    const { recordset: triggers } = await this.pool.request().query(
      `SELECT name AS trigger_name, is_disabled
       FROM ${dbName}.sys.triggers 
       WHERE parent_id = OBJECT_ID('${dbName}.dbo.${tableName}')`
    );

    return {
      db_name: dbName,
      table_name: tableName,
      columns: columns.map((col) => ({
        column_name: col.column_name,
        data_type: col.data_type,
        is_nullable: col.is_nullable === 'YES',
        default_value: col.column_default
      })),
      indexes: indexes.map((idx) => ({
        index_name: idx.index_name,
        is_unique: idx.is_unique,
        type: idx.type_desc
      })),
      foreign_keys: foreignKeys.map((fk) => ({
        fk_name: fk.fk_name,
        table_name: fk.table_name,
        referenced_table: fk.referenced_table
      })),
      triggers: triggers.map((trig) => ({
        trigger_name: trig.trigger_name,
        is_disabled: trig.is_disabled
      })),
    };
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    await this.switchDatabase(dbName);
    const tableDetails = [];

    for (const table of tableNames) {
      const tableInfo = await this.getTableInfo(dbName, table);
      tableDetails.push(tableInfo);
    }

    return tableDetails;
  }
}

module.exports = MSSQLStrategy;