// config/database-context.js (Updated for singleton pattern)
const fs = require("fs").promises;
const path = require("path");
const MySQLStrategy = require("./db_strategies/mysql-strategy");
const PostgreSQLStrategy = require("./db_strategies/postgresql-strategy");
const SQLiteStrategy = require("./db_strategies/sqlite-strategy");
const MSSQLStrategy = require("./db_strategies/mssql-strategy");
const OracleStrategy = require("./db_strategies/oracle-strategy");

class DatabaseContext {
  constructor() {
    this.strategy = null;
    this.currentDbType = null;
    this.isConnected = false;
    this.strategies = {
      mysql2: MySQLStrategy,
      pg: PostgreSQLStrategy,
      sqlite3: SQLiteStrategy,
      mssql: MSSQLStrategy,
      oracledb: OracleStrategy,
    };
  }

  setStrategy(dbType) {
    // Only create new strategy if dbType changed or no strategy exists
    if (!this.strategy || this.currentDbType !== dbType) {
      if (!this.strategies[dbType]) {
        throw new Error(`Unsupported database type: ${dbType}. Supported types: ${Object.keys(this.strategies).join(", ")}`);
      }
      
      // Disconnect previous strategy if exists
      if (this.strategy && this.isConnected) {
        this.strategy.disconnect();
      }
      
      this.strategy = new this.strategies[dbType]();
      this.currentDbType = dbType;
      this.isConnected = false;
    }
  }

  async connect(config) {
    this.setStrategy(config.dbType);
    
    if (!this.isConnected) {
      await this.strategy.connect(config);
      this.isConnected = true;
    }
    
    return this.strategy;
  }

  async switchDatabase(dbName) {
    if (!this.strategy || !this.isConnected) {
      throw new Error("No active database connection. Call connect first.");
    }
    await this.strategy.switchDatabase(dbName);
  }

  async executeQuery(query, options = {}) {
    if (!this.strategy || !this.isConnected) {
      throw new Error("No active database connection. Call connect first.");
    }
    return await this.strategy.executeQuery(query, options);
  }

  async disconnect() {
    if (this.strategy && this.isConnected) {
      await this.strategy.disconnect();
      this.isConnected = false;
    }
  }

  async validateConnection() {
    if (!this.strategy || !this.isConnected) {
      return false;
    }
    
    try {
      const isValid = await this.strategy.validateConnection();
      if (!isValid) {
        this.isConnected = false;
      }
      return isValid;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  getStrategy() {
    if (!this.strategy || !this.isConnected) {
      throw new Error("No active database connection. Call connect first.");
    }
    return this.strategy;
  }

  isConnectionActive() {
    return this.strategy && this.isConnected;
  }

  getCurrentDbType() {
    return this.currentDbType;
  }

  // Existing methods that delegate to strategy
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
    return await this.getStrategy().getDatabases();
  }

  async getTables(dbName) {
    return await this.getStrategy().getTables(dbName);
  }

  async getTableInfo(dbName, tableName) {
    return await this.getStrategy().getTableInfo(dbName, tableName);
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    return await this.getStrategy().getMultipleTablesInfo(dbName, tableNames);
  }
}

// Export singleton instance
module.exports = new DatabaseContext();