// database-strategy.js
class DatabaseStrategy {
  async connect(config) {
    throw new Error("connect() must be implemented");
  }

  async switchDatabase(dbName) {
    throw new Error("switchDatabase() must be implemented");
  }

  async executeQuery(query, options = {}) {
    throw new Error("executeQuery() must be implemented");
  }

  async disconnect() {
    throw new Error("disconnect() must be implemented");
  }

  async validateConnection() {
    throw new Error("validateConnection() must be implemented");
  }

  async getDatabases() {
    throw new Error("getDatabases() must be implemented");
  }

  async getTables(dbName) {
    throw new Error("getTables() must be implemented");
  }

  async getTableInfo(dbName, tableName) {
    throw new Error("getTableInfo() must be implemented");
  }

  async getMultipleTablesInfo(dbName, tableNames) {
    throw new Error("getMultipleTablesInfo() must be implemented");
  }
}

module.exports = DatabaseStrategy;