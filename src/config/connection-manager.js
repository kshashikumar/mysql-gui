// connection-manager.js
const fs = require("fs").promises;
const path = require("path");
const { CONNECTION_STATES, ERROR_MESSAGES, DEFAULT_CONFIG } = require('../constants/constants');

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.activeConnections = new Map();
    this.connectionStates = new Map();
    this.lastActivity = new Map();
    this.configPath = path.join(__dirname, "dbConnections.json");
  }

  // Connection lifecycle management
  async createConnection(connectionId, strategy, config) {
    try {
      this.setConnectionState(connectionId, CONNECTION_STATES.CONNECTING);
      
      await strategy.connect(config);
      
      this.connections.set(connectionId, {
        strategy,
        config: { ...config, password: '***' }, // Hide password in memory
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
      
      this.activeConnections.set(connectionId, strategy);
      this.setConnectionState(connectionId, CONNECTION_STATES.CONNECTED);
      this.updateLastActivity(connectionId);
      
      return connectionId;
    } catch (error) {
      this.setConnectionState(connectionId, CONNECTION_STATES.ERROR);
      throw error;
    }
  }

  async closeConnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      try {
        await connection.disconnect();
      } catch (error) {
        console.warn(`Error closing connection ${connectionId}:`, error.message);
      }
      
      this.activeConnections.delete(connectionId);
      this.connections.delete(connectionId);
      this.connectionStates.delete(connectionId);
      this.lastActivity.delete(connectionId);
    }
  }

  async closeAllConnections() {
    const connectionIds = Array.from(this.activeConnections.keys());
    await Promise.all(connectionIds.map(id => this.closeConnection(id)));
  }

  // Connection state management
  setConnectionState(connectionId, state) {
    this.connectionStates.set(connectionId, {
      state,
      timestamp: new Date().toISOString()
    });
  }

  getConnectionState(connectionId) {
    return this.connectionStates.get(connectionId)?.state || CONNECTION_STATES.DISCONNECTED;
  }

  updateLastActivity(connectionId) {
    this.lastActivity.set(connectionId, new Date().toISOString());
  }

  // Connection retrieval and validation
  getConnection(connectionId) {
    const strategy = this.activeConnections.get(connectionId);
    if (!strategy) {
      throw new Error(ERROR_MESSAGES.NO_ACTIVE_CONNECTION);
    }
    
    this.updateLastActivity(connectionId);
    return strategy;
  }

  async validateConnection(connectionId) {
    const strategy = this.activeConnections.get(connectionId);
    if (!strategy) {
      this.setConnectionState(connectionId, CONNECTION_STATES.DISCONNECTED);
      return false;
    }

    try {
      const isValid = await strategy.validateConnection();
      this.setConnectionState(connectionId, isValid ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.ERROR);
      return isValid;
    } catch (error) {
      this.setConnectionState(connectionId, CONNECTION_STATES.ERROR);
      return false;
    }
  }

  // Database switching with connection management
  async switchDatabase(connectionId, dbName) {
    const strategy = this.getConnection(connectionId);
    
    try {
      this.setConnectionState(connectionId, CONNECTION_STATES.SWITCHING);
      await strategy.switchDatabase(dbName);
      
      // Update connection info
      const connectionInfo = this.connections.get(connectionId);
      if (connectionInfo) {
        connectionInfo.currentDatabase = dbName;
        connectionInfo.lastUsed = new Date().toISOString();
      }
      
      this.setConnectionState(connectionId, CONNECTION_STATES.CONNECTED);
      this.updateLastActivity(connectionId);
      
      return true;
    } catch (error) {
      this.setConnectionState(connectionId, CONNECTION_STATES.ERROR);
      throw new Error(ERROR_MESSAGES.DATABASE_SWITCH_FAILED(dbName));
    }
  }

  // Connection persistence
  async saveConnections() {
    try {
      const connectionsData = Array.from(this.connections.entries()).map(([id, conn]) => ({
        id,
        config: conn.config,
        createdAt: conn.createdAt,
        lastUsed: conn.lastUsed,
        currentDatabase: conn.currentDatabase,
        state: this.getConnectionState(id)
      }));

      await fs.writeFile(this.configPath, JSON.stringify(connectionsData, null, 2), "utf8");
    } catch (error) {
      console.error("Error saving connections:", error);
      throw error;
    }
  }

  async loadConnections() {
    try {
      const data = await fs.readFile(this.configPath, "utf8");
      const connectionsData = JSON.parse(data);
      
      return connectionsData.map(conn => ({
        id: conn.id,
        username: conn.config.username,
        host: conn.config.host,
        port: conn.config.port,
        dbType: conn.config.dbType,
        database: conn.config.database,
        socketPath: conn.config.socketPath,
        status: conn.state || CONNECTION_STATES.DISCONNECTED,
        lastUsed: conn.lastUsed,
        currentDatabase: conn.currentDatabase
      }));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // No connections file exists yet
      }
      throw error;
    }
  }

  // Connection monitoring and cleanup
  async healthCheck() {
    const results = new Map();
    
    for (const [connectionId, strategy] of this.activeConnections) {
      try {
        const health = await strategy.getConnectionHealth();
        results.set(connectionId, health);
      } catch (error) {
        results.set(connectionId, {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  async cleanupIdleConnections(maxIdleTime = DEFAULT_CONFIG.IDLE_TIMEOUT) {
    const now = Date.now();
    const connectionsToClose = [];
    
    for (const [connectionId, lastActivity] of this.lastActivity) {
      const idleTime = now - new Date(lastActivity).getTime();
      if (idleTime > maxIdleTime) {
        connectionsToClose.push(connectionId);
      }
    }
    
    for (const connectionId of connectionsToClose) {
      console.log(`Closing idle connection: ${connectionId}`);
      await this.closeConnection(connectionId);
    }
    
    return connectionsToClose.length;
  }

  // Connection information
  getConnectionInfo(connectionId) {
    const connection = this.connections.get(connectionId);
    const state = this.getConnectionState(connectionId);
    const lastActivity = this.lastActivity.get(connectionId);
    
    if (!connection) {
      return null;
    }
    
    return {
      id: connectionId,
      config: connection.config,
      state,
      createdAt: connection.createdAt,
      lastUsed: connection.lastUsed,
      lastActivity,
      currentDatabase: connection.currentDatabase
    };
  }

  getAllConnectionsInfo() {
    return Array.from(this.connections.keys()).map(id => this.getConnectionInfo(id));
  }

  getActiveConnectionCount() {
    return this.activeConnections.size;
  }

  // Utility methods
  generateConnectionId(config) {
    const { host, port, username, dbType, database } = config;
    return `${dbType}_${username}@${host}:${port}/${database || 'default'}_${Date.now()}`;
  }

  isConnectionActive(connectionId) {
    return this.activeConnections.has(connectionId) && 
           this.getConnectionState(connectionId) === CONNECTION_STATES.CONNECTED;
  }
}

module.exports = ConnectionManager;