// mssql-strategy.js
const mssql = require("mssql");
const DatabaseStrategy = require("../database-strategy");

class MSSQLStrategy extends DatabaseStrategy {
  constructor() {
    super();
    this.pool = null;
  }

  async connect(config) {
    const { host, port, username, password, database } = config;
    console.log(
      `> Connecting to MSSQL server @ ${host || "localhost"}:${port || 1433} with user ${username}${
        database ? ` and database ${database}` : ""
      }`
    );

    this.pool = new mssql.ConnectionPool({
      server: host || "localhost",
      port: port || 1433,
      user: username,
      password,
      database: database || "master",
      pool: { max: 10, min: 2, idleTimeoutMillis: 30000 },
      options: { encrypt: true, trustServerCertificate: true },
    });

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
      const isTransactionCommand =
        /^BEGIN\s|^START\s|^COMMIT\s|^ROLLBACK\s/i.test(singleQuery);

      if (isSelectQuery) {
        let paginatedQuery = singleQuery;
        const hasLimitOrOffset = /OFFSET\s+\d+/i.test(singleQuery);
        if (!hasLimitOrOffset) {
          const offset = (page - 1) * pageSize;
          paginatedQuery = `${singleQuery} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
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
          recordset = (await this.pool.request().query(`SELECT name AS table_name FROM ${dbName}.sys.tables`)).recordset;
        } else if (isDescribeCommand) {
          const tableName = singleQuery.match(/DESCRIBE\s+(\w+)/i)?.[1];
          if (tableName) {
            recordset = (
              await this.pool.request().query(
                `SELECT column_name, data_type FROM ${dbName}.information_schema.columns WHERE table_name = '${tableName}'`
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
      } else if (isGrantCommand || isRevokeCommand || isTransactionCommand) {
        const adjustedQuery = singleQuery.replace(/BEGIN\s/i, "BEGIN TRAN ");
        await this.pool.request().query(adjustedQuery);
        messages.push({ query: singleQuery, message: `${isGrantCommand || isRevokeCommand ? "Permission" : "Transaction"} command executed successfully` });
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

  async getDatabases() {
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    const { recordset: databases } = await this.pool.request().query("SELECT name FROM sys.databases");
    const databaseStats = [];

    for (const db of databases) {
      const dbName = db.name;
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
    const { recordset: columns } = await this.pool.request().query(
      `SELECT column_name 
       FROM ${dbName}.information_schema.columns 
       WHERE table_name = @p1`,
      [{ name: "p1", type: mssql.NVarChar, value: tableName }]
    );
    const { recordset: indexes } = await this.pool.request().query(
      `SELECT name AS index_name 
       FROM ${dbName}.sys.indexes 
       WHERE object_id = OBJECT_ID('${dbName}.dbo.${tableName}')`
    );
    const { recordset: foreignKeys } = await this.pool.request().query(
      `SELECT name AS fk_name 
       FROM ${dbName}.sys.foreign_keys 
       WHERE parent_object_id = OBJECT_ID('${dbName}.dbo.${tableName}')`
    );
    const { recordset: triggers } = await this.pool.request().query(
      `SELECT name AS trigger_name 
       FROM ${dbName}.sys.triggers 
       WHERE parent_id = OBJECT_ID('${dbName}.dbo.${tableName}')`
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
    if (!this.pool) throw new Error("MSSQL connection not initialized");
    await this.switchDatabase(dbName);
    const tableDetails = [];

    for (const table of tableNames) {
      const { recordset: columns } = await this.pool.request().query(
        `SELECT column_name 
         FROM ${dbName}.information_schema.columns 
         WHERE table_name = @p1`,
        [{ name: "p1", type: mssql.NVarChar, value: table }]
      );
      const { recordset: indexes } = await this.pool.request().query(
        `SELECT name AS index_name 
         FROM ${dbName}.sys.indexes 
         WHERE object_id = OBJECT_ID('${dbName}.dbo.${table}')`
      );
      const { recordset: foreignKeys } = await this.pool.request().query(
        `SELECT name AS fk_name 
         FROM ${dbName}.sys.foreign_keys 
         WHERE parent_object_id = OBJECT_ID('${dbName}.dbo.${table}')`
      );
      const { recordset: triggers } = await this.pool.request().query(
        `SELECT name AS trigger_name 
         FROM ${dbName}.sys.triggers 
         WHERE parent_id = OBJECT_ID('${dbName}.dbo.${table}')`
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

module.exports = MSSQLStrategy;