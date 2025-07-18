// mysql-strategy.js
const mysql = require("mysql2/promise");
const DatabaseStrategy = require("../database-strategy");

class MySQLStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.pool = null;
  }

  async connect(config) {
    const { host, port, username, password, database, socketPath } = config;
    console.log(
      `> Connecting to MySQL server @ ${host || "localhost"}:${port || "default port"} with user ${username}${
        database ? ` and database ${database}` : ""
      }${socketPath ? ` using socket ${socketPath}` : ""}`
    );

    this.pool = await mysql.createPool({
      host: host || "localhost",
      port: host === "localhost" && !port ? undefined : port || 3306,
      user: username,
      password,
      database: database || undefined,
      socketPath: host === "localhost" && socketPath ? socketPath : undefined,
      ssl: host !== "localhost" ? { rejectUnauthorized: false } : undefined,
      //authPlugins: { caching_sha2_password: mysql.authPlugins.caching_sha2_password },
      connectionLimit: 10,
      acquireTimeout: 60000,
      waitForConnections: true,
    });

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
        const [rows] = await this.pool.query(paginatedQuery);
        result.push(...rows);

        if (totalRows === null) {
          const totalRowsQuery = `SELECT COUNT(*) as count FROM (${singleQuery}) as subquery`;
          const [countRows] = await this.pool.query(totalRowsQuery);
          totalRows = countRows[0].count;
        }
      } else if (isShowCommand || isDescribeCommand) {
        const [rows] = await this.pool.query(singleQuery);
        result.push(...rows);
        messages.push({ query: singleQuery, message: "Database command executed successfully" });
      } else if (isInsertCommand || isUpdateCommand || isDeleteCommand || isCreateCommand || isDropCommand || isAlterCommand) {
        const [response] = await this.pool.query(singleQuery);
        messages.push({
          query: singleQuery,
          message: "Command executed successfully",
          affectedRows: response.affectedRows || 0,
        });
      } else if (isGrantCommand || isRevokeCommand || isTransactionCommand) {
        await this.pool.query(singleQuery);
        messages.push({ query: singleQuery, message: `${isGrantCommand || isRevokeCommand ? "Permission" : "Transaction"} command executed successfully` });
      } else {
        messages.push({ query: singleQuery, message: "Command not recognized or unsupported" });
      }
    }

    return { rows: result, totalRows, messages };
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
    await this.switchDatabase(dbName);
    const [columns] = await this.pool.query(
      `SELECT COLUMN_NAME AS column_name 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, tableName]
    );
    const [indexes] = await this.pool.query(
      `SELECT INDEX_NAME AS index_name 
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, tableName]
    );
    const [foreignKeys] = await this.pool.query(
      `SELECT kcu.CONSTRAINT_NAME AS fk_name 
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
       JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
       ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
       WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName, tableName]
    );
    const [triggers] = await this.pool.query(
      `SELECT TRIGGER_NAME AS trigger_name 
       FROM INFORMATION_SCHEMA.TRIGGERS 
       WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?`,
      [dbName, tableName]
    );

    return {
      db_name: dbName,
      table_name: tableName,
      columns: columns.map((col) => ({ column_name: col.column_name })),
      indexes: indexes.map((idx) => ({ index_name: idx.index_name })),
      foreign_keys: foreignKeys.map((fk) => ({ fk_name: fk.fk_name })),
      triggers: triggers.map((trig) => ({ trigger_name: trig.trigger_name })),
    };
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.pool) throw new Error("MySQL connection not initialized");
    await this.switchDatabase(dbName);
    const tableDetails = [];

    for (const table of tableNames) {
      const [columns] = await this.pool.query(
        `SELECT COLUMN_NAME AS column_name 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [dbName, table]
      );
      const [indexes] = await this.pool.query(
        `SELECT INDEX_NAME AS index_name 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [dbName, table]
      );
      const [foreignKeys] = await this.pool.query(
        `SELECT kcu.CONSTRAINT_NAME AS fk_name 
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
         JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
         ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
         WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
        [dbName, table]
      );
      const [triggers] = await this.pool.query(
        `SELECT TRIGGER_NAME AS trigger_name 
         FROM INFORMATION_SCHEMA.TRIGGERS 
         WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?`,
        [dbName, table]
      );

      tableDetails.push({
        table_name: table,
        columns: columns.map((col) => ({ column_name: col.column_name })),
        indexes: indexes.map((idx) => ({ index_name: idx.index_name })),
        foreign_keys: foreignKeys.map((fk) => ({ fk_name: fk.fk_name })),
        triggers: triggers.map((trig) => ({ trigger_name: trig.trigger_name })),
      });
    }

    return tableDetails;
  }
}

module.exports = MySQLStrategy;