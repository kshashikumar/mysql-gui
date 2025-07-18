// sqlite-strategy.js
const sqlite3 = require("sqlite3").verbose();
const DatabaseStrategy = require("../database-strategy");

class SQLiteStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.db = null;
    this.databaseName = null;
  }

  async connect(config) {
    const { database } = config;
    this.databaseName = database || ":memory:";
    console.log(`> Connecting to SQLite database: ${this.databaseName}`);

    this.db = new sqlite3.Database(this.databaseName, (err) => {
      if (err) throw new Error(`SQLite connection error: ${err.message}`);
    });

    await new Promise((resolve, reject) => {
      this.db.run("SELECT 1", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log("> Successfully connected to SQLite database");
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
      const isTransactionCommand =
        /^BEGIN\s|^START\s|^COMMIT\s|^ROLLBACK\s/i.test(singleQuery);

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
            this.db.all(`SELECT name AS table_name FROM sqlite_master WHERE type='table'`, (err, rows) => {
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
      } else if (isInsertCommand || isUpdateCommand || isDeleteCommand || isCreateCommand || isDropCommand || isAlterCommand) {
        const { changes } = await new Promise((resolve, reject) => {
          this.db.run(singleQuery, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
          });
        });
        messages.push({
          query: singleQuery,
          message: "Command executed successfully",
          affectedRows: changes || 0,
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

  async getDatabases() {
    if (!this.db) throw new Error("SQLite connection not initialized");
    const tables = await new Promise((resolve, reject) => {
      this.db.all(`SELECT name AS table_name FROM sqlite_master WHERE type='table'`, (err, rows) => {
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
      sizeOnDisk: 0, // SQLite doesn't provide a direct way to get database size without file system access
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
      this.db.all(`SELECT name AS table_name FROM sqlite_master WHERE type='table'`, (err, rows) => {
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
      this.db.all(`SELECT name AS trigger_name FROM sqlite_master WHERE type='trigger' AND tbl_name='${tableName}'`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    return {
      db_name: dbName,
      table_name: tableName,
      columns: columns.map((col) => ({ column_name: col.name })),
      indexes: indexes.map((idx) => ({ index_name: idx.name })),
      foreign_keys: foreignKeys.map((fk) => ({ fk_name: `fk_${fk.id}_${fk.table}` })),
      triggers: triggers.map((trig) => ({ trigger_name: trig.trigger_name })),
    };
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.db) throw new Error("SQLite connection not initialized");
    if (dbName !== this.databaseName && dbName !== ":memory:") {
      throw new Error("SQLite does not support switching databases");
    }
    const tableDetails = [];

    for (const table of tableNames) {
      const columns = await new Promise((resolve, reject) => {
        this.db.all(`PRAGMA table_info(${table})`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      const indexes = await new Promise((resolve, reject) => {
        this.db.all(`PRAGMA index_list(${table})`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      const foreignKeys = await new Promise((resolve, reject) => {
        this.db.all(`PRAGMA foreign_key_list(${table})`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      const triggers = await new Promise((resolve, reject) => {
        this.db.all(`SELECT name AS trigger_name FROM sqlite_master WHERE type='trigger' AND tbl_name='${table}'`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      tableDetails.push({
        table_name: table,
        columns: columns.map((col) => ({ column_name: col.name })),
        indexes: indexes.map((idx) => ({ index_name: idx.name })),
        foreign_keys: foreignKeys.map((fk) => ({ fk_name: `fk_${fk.id}_${fk.table}` })),
        triggers: triggers.map((trig) => ({ trigger_name: trig.trigger_name })),
      });
    }

    return tableDetails;
  }
}

module.exports = SQLiteStrategy;