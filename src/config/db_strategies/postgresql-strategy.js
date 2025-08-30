// postgresql-strategy.js (Fixed version)
const { Pool } = require("pg");
const DatabaseStrategy = require("../database-strategy");

class PostgreSQLStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.pool = null;
    this.currentSchema = 'public'; // Track current schema
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
      idleTimeout,
      maxConnections,
      statement_timeout,
      query_timeout,
      application_name,
      schema
    } = config;

    console.log(
      `> Connecting to PostgreSQL server @ ${host || "localhost"}:${port || 5432} with user ${username}${
        database ? ` and database ${database}` : ""
      }${ssl ? " with SSL" : ""}`
    );

    // Build connection configuration with all optional parameters
    const connectionConfig = {
      host: host || "localhost",
      port: parseInt(port) || 5432,
      user: username,
      password,
      database: database || "postgres",
      
      // SSL Configuration
      ssl: ssl ? (typeof ssl === 'object' ? ssl : { rejectUnauthorized: false }) : false,
      
      // Pool Configuration
      max: parseInt(maxConnections) || parseInt(poolSize) || 10,
      min: 2,
      connectionTimeoutMillis: parseInt(connectionTimeout) || 60000,
      idleTimeoutMillis: parseInt(idleTimeout) || 30000,
      
      // Query Configuration
      statement_timeout: parseInt(statement_timeout) || 0,
      query_timeout: parseInt(query_timeout) || 0,
      
      // Application Configuration
      application_name: application_name || 'PostgreSQL-GUI-App', // Fixed name
      
      // Additional PostgreSQL options
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
      parseInputDatesAsUTC: false,
      
      // Client encoding
      client_encoding: 'UTF8',
      
      // Timezone
      timezone: 'UTC'
    };

    // Remove undefined values
    Object.keys(connectionConfig).forEach(key => {
      if (connectionConfig[key] === undefined) {
        delete connectionConfig[key];
      }
    });

    this.pool = new Pool(connectionConfig);
    this.currentSchema = schema || 'public';

    // Test connection and set schema
    await this.pool.query("SELECT 1");
    if (this.currentSchema !== 'public') {
      await this.pool.query(`SET search_path TO "${this.currentSchema}"`);
    }
    console.log("> Successfully connected to PostgreSQL server");
  }

  async switchDatabase(dbName) {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    
    // In PostgreSQL, we need to connect to a different database, not just switch schemas
    // Close current pool and create new one with the target database
    const originalConfig = this.pool.options;
    
    // End current pool
    await this.pool.end();
    
    // Create new pool with target database
    const newConfig = {
      host: originalConfig.host,
      port: originalConfig.port,
      user: originalConfig.user,
      password: originalConfig.password,
      database: dbName,
      ssl: originalConfig.ssl,
      max: originalConfig.max,
      min: originalConfig.min,
      connectionTimeoutMillis: originalConfig.connectionTimeoutMillis,
      idleTimeoutMillis: originalConfig.idleTimeoutMillis,
      keepAlive: originalConfig.keepAlive,
      keepAliveInitialDelayMillis: originalConfig.keepAliveInitialDelayMillis,
      parseInputDatesAsUTC: originalConfig.parseInputDatesAsUTC,
      client_encoding: originalConfig.client_encoding,
      timezone: originalConfig.timezone,
      application_name: originalConfig.application_name
    };
    
    // Remove undefined values
    Object.keys(newConfig).forEach(key => {
      if (newConfig[key] === undefined) {
        delete newConfig[key];
      }
    });
    
    this.pool = new Pool(newConfig);
    
    // Test the new connection
    await this.pool.query("SELECT 1");
    
    // Reset to public schema in the new database
    this.currentSchema = 'public';
    
    console.log(`> Switched to PostgreSQL database: ${dbName}`);
  }

  async executeQuery(query, options = { page: 1, pageSize: 10 }) {
  if (!this.pool) throw new Error("PostgreSQL connection not initialized");
  const page = Number(options.page) || 1;
  const pageSize = Number(options.pageSize) || 10;

  const statements = query
    .split(";")
    .map((q) => q.trim())
    .filter((q) => q);

  const queries = [];

  for (let single of statements) {
    const started = Date.now();

    // strip current database prefix (db.table -> table) if present
    const currentDb = this.pool.options.database;
    if (currentDb) {
      const dbRx = new RegExp(`\\b${currentDb}\\.([a-zA-Z_][a-zA-Z0-9_]*)\\b`, "g");
      single = single.replace(dbRx, "$1");
    }

    const isSelect = /^SELECT\s/i.test(single);
    const isShow = /^SHOW\s/i.test(single);
    const isDescribe = /^DESCRIBE\s/i.test(single);
    const isInsert = /^INSERT\s/i.test(single);
    const isUpdate = /^UPDATE\s/i.test(single);
    const isDelete = /^DELETE\s/i.test(single);
    const isCreate = /^CREATE\s/i.test(single);
    const isDrop = /^DROP\s/i.test(single);
    const isAlter = /^ALTER\s/i.test(single);
    const isGrant = /^GRANT\s/i.test(single);
    const isRevoke = /^REVOKE\s/i.test(single);
    const isTxn = /^(BEGIN|START|COMMIT|ROLLBACK)\b/i.test(single);

    let entry = {
      query: single,
      type: "other",
      rows: [],
      totalRows: null,
      messages: [],
      pagination: undefined,
      stats: undefined,
    };

    try {
      if (isSelect) {
        entry.type = "select";
        let paginated = single;
        const hasLimitOffset = /LIMIT\s+\d+/i.test(single) || /OFFSET\s+\d+/i.test(single);
        if (!hasLimitOffset) {
          const offset = (page - 1) * pageSize;
          paginated = `${single} LIMIT ${pageSize} OFFSET ${offset}`;
        }
        const { rows } = await this.pool.query(paginated);
        entry.rows = rows;

        try {
          const cntSql = `SELECT COUNT(*)::int AS count FROM (${single}) AS subquery`;
          const { rows: cnt } = await this.pool.query(cntSql);
          entry.totalRows = Number(cnt[0].count) || 0;
          entry.pagination = {
            page,
            pageSize,
            totalPages: Math.ceil(entry.totalRows / pageSize),
            hasMore: page * pageSize < entry.totalRows,
          };
        } catch {
          entry.totalRows = rows.length;
        }
      } else if (isShow || isDescribe) {
        entry.type = "schema";
        let res;
        if (isShow && /SHOW\s+TABLES/i.test(single)) {
          res = await this.pool.query(
            `SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
            [this.currentSchema]
          );
        } else if (isDescribe) {
          const table = single.match(/DESCRIBE\s+(\w+)/i)?.[1];
          if (table) {
            res = await this.pool.query(
              `SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns 
               WHERE table_schema = $1 AND table_name = $2
               ORDER BY ordinal_position`,
              [this.currentSchema, table]
            );
          }
        }
        entry.rows = res?.rows || [];
        entry.messages.push({ query: single, message: "Schema command executed successfully" });
      } else if (isInsert || isUpdate || isDelete) {
        entry.type = "dml";
        const r = await this.pool.query(single);
        entry.messages.push({
          query: single,
          message: "Command executed successfully",
          affectedRows: r.rowCount || 0,
        });
        entry.stats = { affectedRows: r.rowCount || 0 };
      } else if (isCreate || isDrop || isAlter) {
        entry.type = "ddl";
        const r = await this.pool.query(single);
        entry.messages.push({
          query: single,
          message: "DDL executed successfully",
          affectedRows: r.rowCount || 0,
        });
        entry.stats = { affectedRows: r.rowCount || 0 };
      } else if (isGrant || isRevoke || isTxn) {
        entry.type = isTxn ? "transaction" : "permission";
        await this.pool.query(single);
        entry.messages.push({
          query: single,
          message: isTxn ? "Transaction command executed successfully" : "Permission command executed successfully",
        });
      } else {
        entry.messages.push({ query: single, message: "Command not recognized or unsupported" });
      }
    } catch (err) {
      entry.messages.push({ query: single, error: true, message: err.message });
    } finally {
      entry.stats = { ...(entry.stats || {}), elapsedMs: Date.now() - started };
      queries.push(entry);
    }
  }

  return {
    queries,
    totalQueries: queries.length,
    executedAt: new Date().toISOString(),
  };
}


  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      console.log("> Disconnected from PostgreSQL database");
      this.pool = null;
    }
  }

  async validateConnection() {
    if (!this.pool) return false;
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch (err) {
      console.error("PostgreSQL connection validation failed:", err);
      return false;
    }
  }

  // Get connection pool statistics
  async getConnectionStats() {
    if (!this.pool) return null;
    
    try {
      const { rows } = await this.pool.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      return {
        totalConnections: parseInt(rows[0].total_connections),
        activeConnections: parseInt(rows[0].active_connections),
        idleConnections: parseInt(rows[0].idle_connections),
        poolTotal: this.pool.totalCount,
        poolIdle: this.pool.idleCount,
        poolWaiting: this.pool.waitingCount
      };
    } catch (err) {
      console.error("Error getting connection stats:", err);
      return null;
    }
  }

  async getDatabases() {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    const { rows: databases } = await this.pool.query("SELECT datname AS name FROM pg_database WHERE datistemplate = false");
    const databaseStats = [];

    // Get the original connection config
    const originalConfig = this.pool.options;

    for (const db of databases) {
      const dbName = db.name;
      const { rows: sizeData } = await this.pool.query(
        `SELECT pg_database_size($1) AS size_on_disk`,
        [dbName]
      );
      const sizeOnDisk = parseInt(sizeData[0].size_on_disk) || 0;

      // Get tables from the correct database by temporarily connecting
      let tablesData = [];
      let viewsData = [];
      
      try {
        // Create temporary connection to the specific database with proper config
        const tempConfig = {
          host: originalConfig.host,
          port: originalConfig.port,
          user: originalConfig.user,
          password: originalConfig.password,
          database: dbName,
          ssl: originalConfig.ssl,
          max: 1, // Only need one connection for this query
          connectionTimeoutMillis: originalConfig.connectionTimeoutMillis
        };
        
        const tempPool = new Pool(tempConfig);
        
        const { rows: tables } = await tempPool.query(
          `SELECT table_name 
           FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );

        const { rows: views } = await tempPool.query(
          `SELECT table_name AS view_name 
           FROM information_schema.views 
           WHERE table_schema = 'public'`
        );

        tablesData = tables.map((table) => ({ name: table.table_name }));
        viewsData = views.map((view) => ({ name: view.view_name }));
        
        await tempPool.end();
      } catch (err) {
        console.warn(`Could not get tables/views for database ${dbName}:`, err.message);
        // If we can't connect to that database, continue with empty arrays
      }

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
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    
    // If dbName is provided and different from current, switch to it first
    if (dbName && dbName !== this.pool.options.database) {
      await this.switchDatabase(dbName);
    }
    
    const { rows } = await this.pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
      [this.currentSchema]
    );
    return rows.map((row) => row.table_name);
  }

  async getTableInfo(dbName, tableName) {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    
    // If dbName is provided and different from current, switch to it first
    if (dbName && dbName !== this.pool.options.database) {
      await this.switchDatabase(dbName);
    }
    
    const schemaName = this.currentSchema;
    
    const { rows: columns } = await this.pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns 
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schemaName, tableName]
    );
    
    const { rows: indexes } = await this.pool.query(
      `SELECT indexname AS index_name, indexdef
       FROM pg_indexes 
       WHERE schemaname = $1 AND tablename = $2`,
      [schemaName, tableName]
    );
    
    const { rows: foreignKeys } = await this.pool.query(
      `SELECT conname AS fk_name, 
              pg_get_constraintdef(c.oid) AS constraint_def
       FROM pg_constraint c 
       WHERE contype = 'f' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1) 
       AND conrelid = (SELECT oid FROM pg_class WHERE relname = $2)`,
      [schemaName, tableName]
    );
    
    const { rows: triggers } = await this.pool.query(
      `SELECT tgname AS trigger_name, 
              pg_get_triggerdef(t.oid) AS trigger_def
       FROM pg_trigger t 
       WHERE tgrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2))
       AND NOT tgisinternal`,
      [tableName, schemaName]
    );

    return {
      db_name: this.pool.options.database, // Return actual database name
      table_name: tableName,
      columns: columns.map((col) => ({
        column_name: col.column_name,
        data_type: col.data_type,
        is_nullable: col.is_nullable === 'YES',
        default_value: col.column_default
      })),
      indexes: indexes.map((idx) => ({
        index_name: idx.index_name,
        definition: idx.indexdef
      })),
      foreign_keys: foreignKeys.map((fk) => ({
        fk_name: fk.fk_name,
        definition: fk.constraint_def
      })),
      triggers: triggers.map((trig) => ({
        trigger_name: trig.trigger_name,
        definition: trig.trigger_def
      })),
    };
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    const tableDetails = [];

    for (const table of tableNames) {
      const tableInfo = await this.getTableInfo(dbName, table);
      tableDetails.push(tableInfo);
    }

    return tableDetails;
  }
}

module.exports = PostgreSQLStrategy;