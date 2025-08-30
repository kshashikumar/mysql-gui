// oracle-strategy.js (Fixed version)
const oracledb = require("oracledb");
const DatabaseStrategy = require("../database-strategy");

class OracleStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.pool = null;
    this.currentSchema = null; // Track current schema
  }

  async connect(config) {
    const { 
      host, 
      port, 
      username, 
      password, 
      database,
      connectionTimeout,
      poolSize,
      poolMin,
      poolTimeout,
      serviceName,
      sid,
      walletLocation,
      walletPassword,
      edition,
      privilege,
      externalAuth
    } = config;

    console.log(
      `> Connecting to Oracle server @ ${host || "localhost"}:${port || 1521}/${serviceName || database || "XE"} with user ${username}${
        edition ? ` edition ${edition}` : ""
      }${privilege ? ` with ${privilege} privilege` : ""}`
    );

    // Build connection string
    let connectString;
    if (serviceName) {
      connectString = `${host || "localhost"}:${port || 1521}/${serviceName}`;
    } else if (sid) {
      connectString = `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host || "localhost"})(PORT=${port || 1521}))(CONNECT_DATA=(SID=${sid})))`;
    } else {
      connectString = `${host || "localhost"}:${port || 1521}/${database || "XE"}`;
    }

    // Build pool configuration with optional parameters
    const poolConfig = {
      user: username,
      password,
      connectString,
      
      // Pool configuration
      poolMax: parseInt(poolSize) || 10,
      poolMin: parseInt(poolMin) || 2,
      poolTimeout: parseInt(poolTimeout) || 30,
      poolIncrement: 1,
      
      // Connection configuration
      connectionTimeout: parseInt(connectionTimeout) || 60000,
      
      // Security options
      privilege: privilege ? oracledb[privilege.toUpperCase()] : undefined,
      edition: edition || undefined,
      externalAuth: externalAuth || false,
      
      // Wallet configuration (for cloud connections)
      walletLocation: walletLocation || undefined,
      walletPassword: walletPassword || undefined,
      
      // Additional options
      stmtCacheSize: 30,
      enableStatistics: false,
      queueMax: 500,
      queueTimeout: 60000,
      
      // Session configuration
      sessionCallback: undefined,
      sodaMetaDataCache: false,
      
      // Event configuration
      events: false
    };

    // Remove undefined values
    Object.keys(poolConfig).forEach(key => {
      if (poolConfig[key] === undefined) {
        delete poolConfig[key];
      }
    });

    this.pool = await oracledb.createPool(poolConfig);
    this.currentSchema = username; // Default to connected user's schema

    // Test connection
    const connection = await this.pool.getConnection();
    await connection.execute("SELECT 1 FROM DUAL");
    await connection.close();
    console.log("> Successfully connected to Oracle server");
  }

  async switchDatabase(dbName) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    // In Oracle, we switch schemas, not databases - just track the schema name
    this.currentSchema = dbName;
    console.log(`> Switched to Oracle schema: ${dbName}`);
  }

  async executeQuery(query, options = { page: 1, pageSize: 10 }) {
  if (!this.pool) throw new Error("Oracle connection not initialized");
  const page = Number(options.page) || 1;
  const pageSize = Number(options.pageSize) || 10;

  const statements = query
    .split(";")
    .map((q) => q.trim())
    .filter((q) => q);

  const connection = await this.pool.getConnection();
  const queries = [];

  try {
    if (this.currentSchema) {
      await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = "${this.currentSchema}"`);
    }

    for (let single of statements) {
      const started = Date.now();
      // strip schema prefix of currentSchema if present
      if (this.currentSchema) {
        const rx = new RegExp(`\\b${this.currentSchema}\\.([a-zA-Z_][a-zA-Z0-9_]*)\\b`, "gi");
        single = single.replace(rx, "$1");
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
          const hasFetch = /FETCH\s+FIRST\s+\d+\s+ROWS\s+ONLY/i.test(single) || /OFFSET\s+\d+\s+ROWS/i.test(single);
          if (!hasFetch) {
            const offset = (page - 1) * pageSize;
            paginated =
              offset > 0
                ? `${single} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`
                : `${single} FETCH FIRST ${pageSize} ROWS ONLY`;
          }
          const res = await connection.execute(paginated, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
          entry.rows = res.rows || [];

          try {
            const cntSql = `SELECT COUNT(*) AS COUNT FROM (${single})`;
            const cnt = await connection.execute(cntSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
            entry.totalRows = Number(cnt.rows?.[0]?.COUNT) || 0;
            entry.pagination = {
              page,
              pageSize,
              totalPages: Math.ceil(entry.totalRows / pageSize),
              hasMore: page * pageSize < entry.totalRows,
            };
          } catch {
            entry.totalRows = entry.rows.length;
          }
        } else if (isShow || isDescribe) {
          entry.type = "schema";
          let res;
          if (isShow && /SHOW\s+TABLES/i.test(single)) {
            res = await connection.execute(
              `SELECT table_name FROM user_tables ORDER BY table_name`,
              [],
              { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
          } else if (isDescribe) {
            const table = single.match(/DESCRIBE\s+(\w+)/i)?.[1];
            if (table) {
              res = await connection.execute(
                `SELECT column_name, data_type, nullable, data_default 
                 FROM user_tab_columns 
                 WHERE table_name = UPPER(:1) 
                 ORDER BY column_id`,
                [table],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
              );
            }
          }
          entry.rows = res?.rows || [];
          entry.messages.push({ query: single, message: "Schema command executed successfully" });
        } else if (isInsert || isUpdate || isDelete) {
          entry.type = "dml";
          const r = await connection.execute(single);
          await connection.commit();
          entry.messages.push({
            query: single,
            message: "Command executed successfully",
            affectedRows: r.rowsAffected || 0,
          });
          entry.stats = { affectedRows: r.rowsAffected || 0 };
        } else if (isCreate || isDrop || isAlter) {
          entry.type = "ddl";
          const r = await connection.execute(single);
          await connection.commit();
          entry.messages.push({
            query: single,
            message: "DDL executed successfully",
            affectedRows: r.rowsAffected || 0,
          });
          entry.stats = { affectedRows: r.rowsAffected || 0 };
        } else if (isGrant || isRevoke || isTxn) {
          entry.type = isTxn ? "transaction" : "permission";
          await connection.execute(single);
          if (!isTxn) await connection.commit();
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
  } finally {
    await connection.close();
  }

  return {
    queries,
    totalQueries: queries.length,
    executedAt: new Date().toISOString(),
  };
}


  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      console.log("> Disconnected from Oracle database");
      this.pool = null;
    }
  }

  async validateConnection() {
    if (!this.pool) return false;
    try {
      const connection = await this.pool.getConnection();
      await connection.execute("SELECT 1 FROM DUAL");
      await connection.close();
      return true;
    } catch (err) {
      console.error("Oracle connection validation failed:", err);
      return false;
    }
  }

  // Get connection pool statistics
  async getConnectionStats() {
    if (!this.pool) return null;
    
    try {
      const connection = await this.pool.getConnection();
      try {
        const { rows } = await connection.execute(`
          SELECT 
            COUNT(*) as total_sessions,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_sessions,
            SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) as inactive_sessions
          FROM v$session 
          WHERE type = 'USER'
        `, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        return {
          totalSessions: parseInt(rows[0].TOTAL_SESSIONS),
          activeSessions: parseInt(rows[0].ACTIVE_SESSIONS),
          inactiveSessions: parseInt(rows[0].INACTIVE_SESSIONS),
          poolConnections: this.pool.connectionsOpen,
          poolConnecting: this.pool.connectionsInUse
        };
      } finally {
        await connection.close();
      }
    } catch (err) {
      console.error("Error getting connection stats:", err);
      return null;
    }
  }

  async getDatabases() {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const connection = await this.pool.getConnection();
    try {
      const { rows: schemas } = await connection.execute(
        "SELECT username AS name FROM all_users WHERE username NOT IN ('SYS', 'SYSTEM', 'DBSNMP', 'SYSMAN', 'OUTLN', 'MDSYS', 'ORDSYS', 'EXFSYS', 'DMSYS', 'WMSYS', 'CTXSYS', 'ANONYMOUS', 'XDB', 'XS$NULL', 'ORACLE_OCM', 'APPQOSSYS', 'GGSYS', 'OJVMSYS', 'DVF', 'DVSYS') ORDER BY username",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const databaseStats = [];

      for (const schema of schemas) {
        const schemaName = schema.NAME;
        try {
          // Get schema size
          const { rows: sizeData } = await connection.execute(
            `SELECT NVL(SUM(bytes), 0) AS size_on_disk FROM dba_segments WHERE owner = :1`,
            [schemaName],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          const sizeOnDisk = parseInt(sizeData[0].SIZE_ON_DISK) || 0;

          // Get tables for this schema
          const { rows: tables } = await connection.execute(
            `SELECT table_name FROM all_tables WHERE owner = :1 ORDER BY table_name`,
            [schemaName],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );

          // Get views for this schema
          const { rows: views } = await connection.execute(
            `SELECT view_name FROM all_views WHERE owner = :1 ORDER BY view_name`,
            [schemaName],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );

          const tablesData = tables.map((table) => ({ name: table.TABLE_NAME }));
          const viewsData = views.map((view) => ({ name: view.VIEW_NAME }));

          databaseStats.push({
            name: schemaName,
            sizeOnDisk,
            tables: tablesData,
            views: viewsData,
          });
        } catch (err) {
          console.warn(`Cannot access schema ${schemaName}: ${err.message}`);
          databaseStats.push({
            name: schemaName,
            sizeOnDisk: 0,
            tables: [],
            views: [],
            error: "Access denied"
          });
        }
      }

      return databaseStats;
    } finally {
      await connection.close();
    }
  }

  async getTables(dbName) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const connection = await this.pool.getConnection();
    try {
      const schemaName = dbName || this.currentSchema;
      const { rows } = await connection.execute(
        `SELECT table_name FROM all_tables WHERE owner = :1 ORDER BY table_name`,
        [schemaName],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return rows.map((row) => row.TABLE_NAME);
    } finally {
      await connection.close();
    }
  }

  async getTableInfo(dbName, tableName) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const connection = await this.pool.getConnection();
    try {
      const schemaName = dbName || this.currentSchema;
      
      const { rows: columns } = await connection.execute(
        `SELECT column_name, data_type, nullable, data_default, data_length
         FROM all_tab_columns 
         WHERE owner = :1 AND table_name = UPPER(:2)
         ORDER BY column_id`,
        [schemaName, tableName],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      const { rows: indexes } = await connection.execute(
        `SELECT index_name, uniqueness, index_type
         FROM all_indexes 
         WHERE owner = :1 AND table_name = UPPER(:2)
         ORDER BY index_name`,
        [schemaName, tableName],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      const { rows: foreignKeys } = await connection.execute(
        `SELECT constraint_name AS fk_name, r_constraint_name, delete_rule
         FROM all_constraints 
         WHERE constraint_type = 'R' AND owner = :1 AND table_name = UPPER(:2)
         ORDER BY constraint_name`,
        [schemaName, tableName],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      const { rows: triggers } = await connection.execute(
        `SELECT trigger_name, trigger_type, triggering_event, status
         FROM all_triggers 
         WHERE owner = :1 AND table_name = UPPER(:2)
         ORDER BY trigger_name`,
        [schemaName, tableName],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      return {
        db_name: schemaName,
        table_name: tableName,
        columns: columns.map((col) => ({
          column_name: col.COLUMN_NAME,
          data_type: col.DATA_TYPE,
          is_nullable: col.NULLABLE === 'Y',
          default_value: col.DATA_DEFAULT,
          data_length: col.DATA_LENGTH
        })),
        indexes: indexes.map((idx) => ({
          index_name: idx.INDEX_NAME,
          is_unique: idx.UNIQUENESS === 'UNIQUE',
          index_type: idx.INDEX_TYPE
        })),
        foreign_keys: foreignKeys.map((fk) => ({
          fk_name: fk.FK_NAME,
          referenced_constraint: fk.R_CONSTRAINT_NAME,
          delete_rule: fk.DELETE_RULE
        })),
        triggers: triggers.map((trig) => ({
          trigger_name: trig.TRIGGER_NAME,
          trigger_type: trig.TRIGGER_TYPE,
          triggering_event: trig.TRIGGERING_EVENT,
          status: trig.STATUS
        })),
      };
    } finally {
      await connection.close();
    }
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const tableDetails = [];

    for (const table of tableNames) {
      const tableInfo = await this.getTableInfo(dbName, table);
      tableDetails.push(tableInfo);
    }

    return tableDetails;
  }
}

module.exports = OracleStrategy;