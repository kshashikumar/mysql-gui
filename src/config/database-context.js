
const fs = require("fs").promises;
exports.fs = fs;
const path = require("path");
const MySQLStrategy = require("./db_strategies/mysql-strategy");
const PostgreSQLStrategy = require("./db_strategies/postgresql-strategy");
const SQLiteStrategy = require("./db_strategies/sqlite-strategy");
const MSSQLStrategy = require("./db_strategies/mssql-strategy");
const OracleStrategy = require("./db_strategies/oracle-strategy");

class DatabaseContext {
  constructor() {
    this.strategy = null;
    this.strategies = {
      mysql2: new MySQLStrategy(),
      pg: new PostgreSQLStrategy(),
      sqlite3: new SQLiteStrategy(),
      mssql: new MSSQLStrategy(),
      oracledb: new OracleStrategy(),
    };
  }

  setStrategy(dbType) {
    if (!this.strategies[dbType]) {
      throw new Error(`Unsupported database type: ${dbType}. Supported types: ${Object.keys(this.strategies).join(", ")}`);
    }
    this.strategy = this.strategies[dbType];
  }

  async connect(config) {
    if (!this.strategy) throw new Error("Strategy not set. Call setStrategy first.");
    await this.strategy.connect(config);
  }

  async switchDatabase(dbName) {
    if (!this.strategy) throw new Error("Strategy not set. Call setStrategy first.");
    await this.strategy.switchDatabase(dbName);
  }

  async executeQuery(query, options = {}) {
    if (!this.strategy) throw new Error("Strategy not set. Call setStrategy first.");
    return await this.strategy.executeQuery(query, options);
  }

  async disconnect() {
    if (this.strategy) {
      await this.strategy.disconnect();
      this.strategy = null;
    }
  }

  async validateConnection() {
    if (!this.strategy) return false;
    return await this.strategy.validateConnection();
  }

  async getConnections() {
    try {
      const filePath = path.join(__dirname, "dbConnections.json");
      let connections = [];
      try {
        const data = await fs.readFile(filePath, "utf8");
        connections = JSON.parse(data).map((conn) => ({
          username: conn.username,
          password: conn.password,
          host: conn.host,
          port: conn.port,
          dbType: conn.dbType,
          database: conn.database,
          socketPath: conn.socketPath,
          status: conn.status || "Available",
        }));
        console.log("Loaded connections from file:", connections);
      } catch (fileErr) {
        console.log("No existing connections file exist");
        throw fileErr;
      }
      return connections;
    } catch (err) {
      console.error("Error fetching connections:", err);
      return [];
    }
  }

  async saveConnections(connections) {
    try {
      const filePath = path.join(__dirname, "dbConnections.json");
      await fs.writeFile(filePath, JSON.stringify(connections, null, 2), "utf8");
      console.log("Connections saved to file:", connections);
    } catch (err) {
      console.error("Error saving connections to file:", err);
      throw err;
    }
  }

  async getDatabases() {
    if (!this.strategy) throw new Error("Strategy not set. Call setStrategy first.");
    return await this.strategy.getDatabases();
  }

  async getTables(dbName) {
    if (!this.strategy) throw new Error("Strategy not set. Call setStrategy first.");
    return await this.strategy.getTables(dbName);
  }

  async getTableInfo(dbName, tableName) {
    if (!this.strategy) throw new Error("Strategy not set. Call setStrategy first.");
    return await this.strategy.getTableInfo(dbName, tableName);
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    if (!this.strategy) throw new Error("Strategy not set. Call setStrategy first.");
    return await this.strategy.getMultipleTablesInfo(dbName, tableNames);
  }
}

module.exports = DatabaseContext;