// oracle-strategy.js
const oracledb = require("oracledb");
const DatabaseStrategy = require("../database-strategy");

class OracleStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.pool = null;
  }

  async connect(config) {
    const { host, port, username, password, database } = config;
    console.log(
      `> Connecting to Oracle server @ ${host || "localhost"}:${port || 1521}/${database || "XE"} with user ${username}`
    );

    this.pool = await oracledb.createPool({
      user: username,
      password,
      connectString: `${host || "localhost"}:${port || 1521}/${database || "XE"}`,
      poolMax: 10,
      poolMin: 2,
      poolTimeout: 30,
    });

    const connection = await this.pool.getConnection();
    await connection.execute("SELECT 1 FROM DUAL");
    await connection.close();
    console.log("> Successfully connected to Oracle server");
  }

  async switchDatabase(dbName) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${dbName}`);
      console.log(`> Switched to Oracle schema: ${dbName}`);
    } finally {
      await connection.close();
    }
  }

  async executeQuery(query, options = { page: 1, pageSize: 10 }) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const { page, pageSize, dbName } = options;
    let result = [];
    let totalRows = null;
    let messages = [];

    const queries = query
      .split(";")
      .map((q) => q.trim())
      .filter((q) => q);

    const connection = await this.pool.getConnection();
    try {
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
          const hasLimitOrOffset = /FETCH\s+FIRST\s+\d+\s+ROWS\s+ONLY/i.test(singleQuery);
          if (!hasLimitOrOffset) {
            const offset = (page - 1) * pageSize;
            paginatedQuery = `${singleQuery} FETCH FIRST ${pageSize} ROWS ONLY OFFSET ${offset} ROWS`;
          }
          const { rows } = await connection.execute(paginatedQuery);
          result.push(...rows);

          if (totalRows === null) {
            const totalRowsQuery = `SELECT COUNT(*) as count FROM (${singleQuery}) subquery`;
            const { rows: countRows } = await connection.execute(totalRowsQuery);
            totalRows = countRows[0][0];
          }
        } else if (isShowCommand || isDescribeCommand) {
          let rows;
          if (isShowCommand && /SHOW\s+TABLES/i.test(singleQuery)) {
            rows = (await connection.execute(`SELECT table_name FROM user_tables`)).rows;
          } else if (isDescribeCommand) {
            const tableName = singleQuery.match(/DESCRIBE\s+(\w+)/i)?.[1];
            if (tableName) {
              rows = (await connection.execute(`SELECT column_name, data_type FROM user_tab_columns WHERE table_name = UPPER(:1)`, [tableName])).rows;
            }
          }
          if (rows) {
            result.push(...rows);
            messages.push({ query: singleQuery, message: "Database command executed successfully" });
          }
        } else if (isInsertCommand || isUpdateCommand || isDeleteCommand || isCreateCommand || isDropCommand || isAlterCommand) {
          const { rowsAffected } = await connection.execute(singleQuery);
          messages.push({
            query: singleQuery,
            message: "Command executed successfully",
            affectedRows: rowsAffected || 0,
          });
        } else if (isGrantCommand || isRevokeCommand || isTransactionCommand) {
          await connection.execute(singleQuery);
          messages.push({ query: singleQuery, message: `${isGrantCommand || isRevokeCommand ? "Permission" : "Transaction"} command executed successfully` });
        } else {
          messages.push({ query: singleQuery, message: "Command not recognized or unsupported" });
        }
      }
    } finally {
      await connection.close();
    }

    return { rows: result, totalRows, messages };
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

  async getDatabases() {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const connection = await this.pool.getConnection();
    try {
      const { rows: schemas } = await connection.execute("SELECT username AS name FROM all_users WHERE common = 'NO'");
      const databaseStats = [];

      for (const schema of schemas) {
        const schemaName = schema[0];
        await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${schemaName}`);
        const { rows: sizeData } = await connection.execute(
          `SELECT SUM(bytes) AS size_on_disk 
           FROM user_segments`
        );
        const sizeOnDisk = sizeData[0][0] || 0;

        const { rows: tables } = await connection.execute(
          `SELECT table_name 
           FROM user_tables`
        );

        const { rows: views } = await connection.execute(
          `SELECT view_name 
           FROM user_views`
        );

        const tablesData = tables.map((table) => ({ name: table[0] }));
        const viewsData = views.map((view) => ({ name: view[0] }));

        databaseStats.push({
          name: schemaName,
          sizeOnDisk,
          tables: tablesData,
          views: viewsData,
        });
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
      await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${dbName}`);
      const { rows } = await connection.execute(`SELECT table_name FROM user_tables`);
      return rows.map((row) => row[0]);
    } finally {
      await connection.close();
    }
  }

  async getTableInfo(dbName, tableName) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${dbName}`);
      const { rows: columns } = await connection.execute(
        `SELECT column_name 
         FROM user_tab_columns 
         WHERE table_name = UPPER(:1)`,
        [tableName]
      );
      const { rows: indexes } = await connection.execute(
        `SELECT index_name 
         FROM user_indexes 
         WHERE table_name = UPPER(:1)`,
        [tableName]
      );
      const { rows: foreignKeys } = await connection.execute(
        `SELECT constraint_name AS fk_name 
         FROM user_constraints 
         WHERE constraint_type = 'R' AND table_name = UPPER(:1)`,
        [tableName]
      );
      const { rows: triggers } = await connection.execute(
        `SELECT trigger_name 
         FROM user_triggers 
         WHERE table_name = UPPER(:1)`,
        [tableName]
      );

      return {
        db_name: dbName,
        table_name: tableName,
        columns: columns.map((col) => ({ column_name: col[0] })),
        indexes: indexes.map((idx) => ({ index_name: idx[0] })),
        foreign_keys: foreignKeys.map((fk) => ({ fk_name: fk[0] })),
        triggers: triggers.map((trig) => ({ trigger_name: trig[0] })),
      };
    } finally {
      await connection.close();
    }
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.pool) throw new Error("Oracle connection not initialized");
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${dbName}`);
      const tableDetails = [];

      for (const table of tableNames) {
        const { rows: columns } = await connection.execute(
          `SELECT column_name 
           FROM user_tab_columns 
           WHERE table_name = UPPER(:1)`,
          [table]
        );
        const { rows: indexes } = await connection.execute(
          `SELECT index_name 
           FROM user_indexes 
           WHERE table_name = UPPER(:1)`,
          [table]
        );
        const { rows: foreignKeys } = await connection.execute(
          `SELECT constraint_name AS fk_name 
           FROM user_constraints 
           WHERE constraint_type = 'R' AND table_name = UPPER(:1)`,
          [table]
        );
        const { rows: triggers } = await connection.execute(
          `SELECT trigger_name 
           FROM user_triggers 
           WHERE table_name = UPPER(:1)`,
          [table]
        );

        tableDetails.push({
          table_name: table,
          columns: columns.map((col) => ({ column_name: col[0] })),
          indexes: indexes.map((idx) => ({ index_name: idx[0] })),
          foreign_keys: foreignKeys.map((fk) => ({ fk_name: fk[0] })),
          triggers: triggers.map((trig) => ({ trigger_name: trig[0] })),
        });
      }

      return tableDetails;
    } finally {
      await connection.close();
    }
  }
}

module.exports = OracleStrategy;