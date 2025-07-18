// postgresql-strategy.js
const { Pool } = require("pg");
const DatabaseStrategy = require("../database-strategy");

class PostgreSQLStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.pool = null;
  }

  async connect(config) {
    const { host, port, username, password, database } = config;
    console.log(
      `> Connecting to PostgreSQL server @ ${host || "localhost"}:${port || 5432} with user ${username}${
        database ? ` and database ${database}` : ""
      }`
    );

    this.pool = new Pool({
      host: host || "localhost",
      port: port || 5432,
      user: username,
      password,
      database: database || "postgres",
      max: 10,
      connectionTimeoutMillis: 60000,
      idleTimeoutMillis: 30000,
    });

    await this.pool.query("SELECT 1");
    console.log("> Successfully connected to PostgreSQL server");
  }

  async switchDatabase(dbName) {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    await this.pool.query(`SET search_path TO "${dbName}"`);
    console.log(`> Switched to PostgreSQL schema: ${dbName}`);
  }

  async executeQuery(query, options = { page: 1, pageSize: 10 }) {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
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
        const { rows } = await this.pool.query(paginatedQuery);
        result.push(...rows);

        if (totalRows === null) {
          const totalRowsQuery = `SELECT COUNT(*) as count FROM (${singleQuery}) as subquery`;
          const { rows: countRows } = await this.pool.query(totalRowsQuery);
          totalRows = countRows[0].count;
        }
      } else if (isShowCommand || isDescribeCommand) {
        let queryResult;
        if (isShowCommand && /SHOW\s+TABLES/i.test(singleQuery)) {
          queryResult = await this.pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1`, [options.dbName]);
        } else if (isDescribeCommand) {
          const tableName = singleQuery.match(/DESCRIBE\s+(\w+)/i)?.[1];
          if (tableName) {
            queryResult = await this.pool.query(
              `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
              [options.dbName, tableName]
            );
          }
        }
        if (queryResult) {
          result.push(...queryResult.rows);
          messages.push({ query: singleQuery, message: "Database command executed successfully" });
        }
      } else if (isInsertCommand || isUpdateCommand || isDeleteCommand || isCreateCommand || isDropCommand || isAlterCommand) {
        const { rowCount } = await this.pool.query(singleQuery);
        messages.push({
          query: singleQuery,
          message: "Command executed successfully",
          affectedRows: rowCount || 0,
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

  async getDatabases() {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    const { rows: databases } = await this.pool.query("SELECT datname AS name FROM pg_database WHERE datistemplate = false");
    const databaseStats = [];

    for (const db of databases) {
      const dbName = db.name;
      const { rows: sizeData } = await this.pool.query(
        `SELECT pg_database_size($1) AS size_on_disk`,
        [dbName]
      );
      const sizeOnDisk = sizeData[0].size_on_disk || 0;

      const { rows: tables } = await this.pool.query(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_catalog = $1`,
        [dbName]
      );

      const { rows: views } = await this.pool.query(
        `SELECT table_name AS view_name 
         FROM information_schema.views 
         WHERE table_schema = 'public' AND table_catalog = $1`,
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
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    await this.switchDatabase(dbName);
    const { rows } = await this.pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = $1`,
      [dbName]
    );
    return rows.map((row) => row.table_name);
  }

  async getTableInfo(dbName, tableName) {
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    await this.switchDatabase(dbName);
    const { rows: columns } = await this.pool.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = $1 AND table_name = $2`,
      [dbName, tableName]
    );
    const { rows: indexes } = await this.pool.query(
      `SELECT indexname AS index_name 
       FROM pg_indexes 
       WHERE schemaname = $1 AND tablename = $2`,
      [dbName, tableName]
    );
    const { rows: foreignKeys } = await this.pool.query(
      `SELECT conname AS fk_name 
       FROM pg_constraint 
       WHERE contype = 'f' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1) 
       AND conrelid = (SELECT oid FROM pg_class WHERE relname = $2)`,
      [dbName, tableName]
    );
    const { rows: triggers } = await this.pool.query(
      `SELECT tgname AS trigger_name 
       FROM pg_trigger 
       WHERE tgrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2))`,
      [tableName, dbName]
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
    if (!this.pool) throw new Error("PostgreSQL connection not initialized");
    await this.switchDatabase(dbName);
    const tableDetails = [];

    for (const table of tableNames) {
      const { rows: columns } = await this.pool.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = $1 AND table_name = $2`,
        [dbName, table]
      );
      const { rows: indexes } = await this.pool.query(
        `SELECT indexname AS index_name 
         FROM pg_indexes 
         WHERE schemaname = $1 AND tablename = $2`,
        [dbName, table]
      );
      const { rows: foreignKeys } = await this.pool.query(
        `SELECT conname AS fk_name 
         FROM pg_constraint 
         WHERE contype = 'f' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1) 
         AND conrelid = (SELECT oid FROM pg_class WHERE relname = $2)`,
        [dbName, table]
      );
      const { rows: triggers } = await this.pool.query(
        `SELECT tgname AS trigger_name 
         FROM pg_trigger 
         WHERE tgrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2))`,
        [table, dbName]
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

module.exports = PostgreSQLStrategy;