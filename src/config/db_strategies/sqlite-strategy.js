// sqlite-strategy.js (Enhanced with optional parameters)
const sqlite3 = require("sqlite3").verbose();
const DatabaseStrategy = require("../database-strategy");

class SQLiteStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.db = null;
    this.databaseName = null;
  }

  async connect(config) {
    const { 
      database,
      mode,
      verbose,
      busyTimeout,
      cacheSize,
      pageSize,
      journalMode,
      synchronous,
      tempStore,
      lockingMode,
      foreignKeys,
      readOnly
    } = config;

    this.databaseName = database || ":memory:";
    console.log(`> Connecting to SQLite database: ${this.databaseName}${readOnly ? " (read-only)" : ""}`);

    // Determine SQLite mode
    let sqliteMode = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;
    if (readOnly) {
      sqliteMode = sqlite3.OPEN_READONLY;
    }
    if (mode) {
      if (mode.includes('readonly')) {
        sqliteMode = sqlite3.OPEN_READONLY;
      } else if (mode.includes('readwrite')) {
        sqliteMode = sqlite3.OPEN_READWRITE;
      }
    }

    this.db = new sqlite3.Database(this.databaseName, sqliteMode, (err) => {
      if (err) throw new Error(`SQLite connection error: ${err.message}`);
    });

    // Apply configuration options
    try {
      // Set busy timeout
      if (busyTimeout) {
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA busy_timeout = ${parseInt(busyTimeout)}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Set cache size
      if (cacheSize) {
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA cache_size = ${parseInt(cacheSize)}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Set page size (must be set before any tables are created)
      if (pageSize) {
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA page_size = ${parseInt(pageSize)}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Set journal mode
      if (journalMode) {
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA journal_mode = ${journalMode}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Set synchronous mode
      if (synchronous !== undefined) {
        const syncValue = typeof synchronous === 'string' ? synchronous : 
                         synchronous ? 'FULL' : 'OFF';
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA synchronous = ${syncValue}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Set temp store
      if (tempStore) {
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA temp_store = ${tempStore}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Set locking mode
      if (lockingMode) {
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA locking_mode = ${lockingMode}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Enable/disable foreign keys
      if (foreignKeys !== undefined) {
        await new Promise((resolve, reject) => {
          this.db.run(`PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Test connection
      await new Promise((resolve, reject) => {
        this.db.run("SELECT 1", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log("> Successfully connected to SQLite database");
    } catch (err) {
      throw new Error(`SQLite configuration error: ${err.message}`);
    }
  }

  async switchDatabase(dbName) {
    throw new Error("SQLite does not support switching databases");
  }

  async executeQuery(query, options = { page: 1, pageSize: 10 }) {
    if (!this.db) throw new Error("SQLite connection not initialized");
    const { page, pageSize } = options;
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
      const isPragmaCommand = /^PRAGMA\s/i.test(singleQuery);

      if (isSelectQuery) {
        let paginatedQuery = singleQuery;
        const hasLimitOrOffset = /LIMIT\s+\d+/i.test(singleQuery) || /OFFSET\s+\d+/i.test(singleQuery);
        if (!hasLimitOrOffset) {
          const offset = (page - 1) * pageSize;
          paginatedQuery = `${singleQuery} LIMIT ${pageSize} OFFSET ${offset}`;
        }
        const rows = await new Promise((resolve, reject) => {
          this.db.all(paginatedQuery, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        result.push(...rows);

        if (totalRows === null) {
          const totalRowsQuery = `SELECT COUNT(*) as count FROM (${singleQuery}) as subquery`;
          const countRows = await new Promise((resolve, reject) => {
            this.db.all(totalRowsQuery, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          totalRows = countRows[0].count;
        }
      } else if (isShowCommand || isDescribeCommand) {
        let rows;
        if (isShowCommand && /SHOW\s+TABLES/i.test(singleQuery)) {
          rows = await new Promise((resolve, reject) => {
            this.db.all(`SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
        } else if (isDescribeCommand) {
          const tableName = singleQuery.match(/DESCRIBE\s+(\w+)/i)?.[1];
          if (tableName) {
            rows = await new Promise((resolve, reject) => {
              this.db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              });
            });
          }
        }
        if (rows) {
          result.push(...rows);
          messages.push({ query: singleQuery, message: "Database command executed successfully" });
        }
      } else if (isPragmaCommand) {
        const rows = await new Promise((resolve, reject) => {
          this.db.all(singleQuery, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        result.push(...rows);
        messages.push({ query: singleQuery, message: "PRAGMA command executed successfully" });
      } else if (isInsertCommand || isUpdateCommand || isDeleteCommand || isCreateCommand || isDropCommand || isAlterCommand) {
        const { changes, lastID } = await new Promise((resolve, reject) => {
          this.db.run(singleQuery, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
          });
        });
        messages.push({
          query: singleQuery,
          message: "Command executed successfully",
          affectedRows: changes || 0,
          lastInsertId: lastID || null,
        });
      } else if (isGrantCommand || isRevokeCommand) {
        messages.push({ query: singleQuery, message: "GRANT/REVOKE not supported in SQLite" });
      } else if (isTransactionCommand) {
        const adjustedQuery = singleQuery.replace(/BEGIN\s/i, "BEGIN TRANSACTION ");
        await new Promise((resolve, reject) => {
          this.db.run(adjustedQuery, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        messages.push({ query: singleQuery, message: "Transaction command executed successfully" });
      } else {
        messages.push({ query: singleQuery, message: "Command not recognized or unsupported" });
      }
    }

    return { rows: result, totalRows, messages };
  }

  async disconnect() {
    if (this.db) {
      await new Promise((resolve) => this.db.close(() => resolve()));
      console.log("> Disconnected from SQLite database");
      this.db = null;
      this.databaseName = null;
    }
  }

  async validateConnection() {
    if (!this.db) return false;
    try {
      await new Promise((resolve, reject) => {
        this.db.run("SELECT 1", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return true;
    } catch (err) {
      console.error("SQLite connection validation failed:", err);
      return false;
    }
  }

  // Get database statistics
  async getConnectionStats() {
    if (!this.db) return null;
    
    try {
      const stats = await new Promise((resolve, reject) => {
        this.db.all(`
          SELECT 
            (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as table_count,
            (SELECT COUNT(*) FROM sqlite_master WHERE type='index') as index_count,
            (SELECT COUNT(*) FROM sqlite_master WHERE type='view') as view_count
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        });
      });
      
      return {
        databaseName: this.databaseName,
        tableCount: stats.table_count,
        indexCount: stats.index_count,
        viewCount: stats.view_count,
        isMemoryDb: this.databaseName === ':memory:'
      };
    } catch (err) {
      console.error("Error getting connection stats:", err);
      return null;
    }
  }

  async getDatabases() {
    if (!this.db) throw new Error("SQLite connection not initialized");
    
    const tables = await new Promise((resolve, reject) => {
      this.db.all(`SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const views = await new Promise((resolve, reject) => {
      this.db.all(`SELECT name AS view_name FROM sqlite_master WHERE type='view'`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    return [{
      name: this.databaseName,
      sizeOnDisk: 0, // SQLite doesn't provide direct size access
      tables: tables.map((table) => ({ name: table.table_name })),
      views: views.map((view) => ({ name: view.view_name })),
    }];
  }

  async getTables(dbName) {
    if (!this.db) throw new Error("SQLite connection not initialized");
    if (dbName !== this.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    
    const rows = await new Promise((resolve, reject) => {
      this.db.all(`SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    return rows.map((row) => row.table_name);
  }

  async getTableInfo(dbName, tableName) {
    if (!this.db) throw new Error("SQLite connection not initialized");
    if (dbName !== this.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    
    const columns = await new Promise((resolve, reject) => {
      this.db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const indexes = await new Promise((resolve, reject) => {
      this.db.all(`PRAGMA index_list(${tableName})`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const foreignKeys = await new Promise((resolve, reject) => {
      this.db.all(`PRAGMA foreign_key_list(${tableName})`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const triggers = await new Promise((resolve, reject) => {
      this.db.all(`SELECT name AS trigger_name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='${tableName}'`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    return {
      db_name: dbName,
      table_name: tableName,
      columns: columns.map((col) => ({
        column_name: col.name,
        data_type: col.type,
        is_nullable: !col.notnull,
        default_value: col.dflt_value,
        is_primary_key: col.pk === 1
      })),
      indexes: indexes.map((idx) => ({
        index_name: idx.name,
        is_unique: idx.unique === 1,
        origin: idx.origin
      })),
      foreign_keys: foreignKeys.map((fk) => ({
        fk_name: `fk_${fk.id}_${fk.table}`,
        column_name: fk.from,
        referenced_table: fk.table,
        referenced_column: fk.to
      })),
      triggers: triggers.map((trig) => ({
        trigger_name: trig.trigger_name,
        sql: trig.sql
      })),
    };
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.db) throw new Error("SQLite connection not initialized");
    if (dbName !== this.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    
    const tableDetails = [];

    for (const table of tableNames) {
      const tableInfo = await this.getTableInfo(dbName, table);
      tableDetails.push(tableInfo);
    }

    return tableDetails;
  }
}

module.exports = SQLiteStrategy;