// constants.js

const DB_TYPES = {
  MYSQL: 'mysql2',
  POSTGRESQL: 'pg',
  SQLITE: 'sqlite3',
  MSSQL: 'mssql',
  ORACLE: 'oracledb',
  MONGODB: 'mongodb', // For future non-relational support
  REDIS: 'redis'      // For future non-relational support
};

const QUERY_TYPES = {
  SELECT: [/^SELECT\s/i],
  INSERT: [/^INSERT\s/i],
  UPDATE: [/^UPDATE\s/i],
  DELETE: [/^DELETE\s/i],
  CREATE: [/^CREATE\s/i],
  DROP: [/^DROP\s/i],
  ALTER: [/^ALTER\s/i],
  TRUNCATE: [/^TRUNCATE\s/i],
  SHOW: [/^SHOW\s/i],
  DESCRIBE: [/^DESCRIBE\s/i, /^DESC\s/i],
  EXPLAIN: [/^EXPLAIN\s/i],
  GRANT: [/^GRANT\s/i],
  REVOKE: [/^REVOKE\s/i],
  TRANSACTION: [/^BEGIN\s/i, /^START\s/i, /^COMMIT\s/i, /^ROLLBACK\s/i],
  USE: [/^USE\s/i],
  SET: [/^SET\s/i],
  CALL: [/^CALL\s/i],
  EXECUTE: [/^EXEC\s/i, /^EXECUTE\s/i],
  WITH: [/^WITH\s/i], // CTE queries
  MERGE: [/^MERGE\s/i],
  UPSERT: [/^UPSERT\s/i],
  COPY: [/^COPY\s/i],
  BULK: [/^BULK\s/i],
  LOAD: [/^LOAD\s/i],
  IMPORT: [/^IMPORT\s/i],
  EXPORT: [/^EXPORT\s/i]
};

const ERROR_MESSAGES = {
  CONNECTION_NOT_INITIALIZED: 'Database connection not initialized',
  INVALID_DB_TYPE: (type, supported) => `Unsupported database type: ${type}. Supported types: ${supported.join(', ')}`,
  STRATEGY_NOT_SET: 'Strategy not set. Call setStrategy first.',
  NO_ACTIVE_CONNECTION: 'No active database connection. Call connect first.',
  NOT_IMPLEMENTED: (method) => `${method}() must be implemented`,
  INVALID_QUERY: 'Invalid or malformed query',
  PERMISSION_DENIED: 'Insufficient permissions for this operation',
  CONNECTION_TIMEOUT: 'Database connection timeout',
  QUERY_TIMEOUT: 'Query execution timeout',
  INVALID_PAGINATION: 'Invalid pagination parameters',
  DATABASE_SWITCH_FAILED: (dbName) => `Failed to switch to database: ${dbName}`,
  TABLE_NOT_FOUND: (tableName) => `Table not found: ${tableName}`,
  SQLITE_NO_SWITCH: 'SQLite does not support switching databases'
};

const DEFAULT_CONFIG = {
  PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 1000,
  CONNECTION_TIMEOUT: 60000,
  QUERY_TIMEOUT: 30000,
  POOL_SIZE: 10,
  POOL_MIN: 2,
  IDLE_TIMEOUT: 30000
};

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

const HEADERS = {
  DB_TYPE: 'x-db-type',
  CONTENT_TYPE: 'application/json'
};

const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  SWITCHING: 'switching'
};

module.exports = {
  DB_TYPES,
  QUERY_TYPES,
  ERROR_MESSAGES,
  DEFAULT_CONFIG,
  HTTP_STATUS,
  HEADERS,
  CONNECTION_STATES
};