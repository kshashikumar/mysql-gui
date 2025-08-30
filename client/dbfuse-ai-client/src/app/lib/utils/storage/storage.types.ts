import { AppTheme } from '@lib/services/theme';

type StorageObjectMap = {
    appSession: {
        user: string;
        token: string;
    };
    appTheme: AppTheme;
};

export type StorageObjectType = 'appSession' | 'appTheme';

export type StorageObjectData<T extends StorageObjectType> = {
    type: T;
    data: StorageObjectMap[T];
};

export interface newTabData {
    dbName: string;
    tableName: string;
}

export interface openAIEvent {
    openAIEnabled: boolean;
}


export interface IndTableInfo {
    table_name: string;
    columns: any[];
    indexes: any[];
    foreign_keys: any[];
    triggers: any[];
}


interface Column {
    column_name: string;
}

interface Table {
    name: string;
    columns: Column[];
}

export interface DbMeta {
    name: string;
    sizeOnDisk: string;
    tables: Table[];
}

export interface OpenAIPromptResponse {
    query: string;
}

export interface OpenAIPrompt {
    dbMeta: DbMeta[];
    databaseName: string;
    prompt: string;
}


// Enhanced storage types to support new backend features

// Database Types
export type DatabaseType = 'mysql2' | 'pg' | 'sqlite3' | 'mssql' | 'oracledb';

// Basic Connection Interface (existing structure)
export interface Connection {
  id: number | string; // Allow both for backward compatibility
  username: string;
  password: string;
  host: string;
  port: number;
  dbType: DatabaseType;
  database?: string;
  socketPath?: string;
  status?: string;
  createdAt?: string;
  lastUsed?: string | null;
  
  // Enhanced optional parameters
  ssl?: boolean | object;
  connectionTimeout?: number;
  poolSize?: number;
  
  // MySQL specific
  charset?: string;
  timezone?: string;
  acquireTimeout?: number;
  waitForConnections?: boolean;
  queueLimit?: number;
  reconnect?: boolean;
  idleTimeout?: number;
  
  // PostgreSQL specific
  maxConnections?: number;
  statement_timeout?: number;
  query_timeout?: number;
  application_name?: string;
  schema?: string;
  
  // MSSQL specific
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  instanceName?: string;
  domain?: string;
  requestTimeout?: number;
  cancelTimeout?: number;
  packetSize?: number;
  appName?: string;
  
  // Oracle specific
  serviceName?: string;
  sid?: string;
  walletLocation?: string;
  walletPassword?: string;
  edition?: string;
  privilege?: string;
  externalAuth?: boolean;
  poolMin?: number;
  poolTimeout?: number;
  
  // SQLite specific
  mode?: string;
  verbose?: boolean;
  busyTimeout?: number;
  cacheSize?: number;
  pageSize?: number;
  journalMode?: string;
  synchronous?: string | boolean;
  tempStore?: string;
  lockingMode?: string;
  foreignKeys?: boolean;
  readOnly?: boolean;
}

// Connection Configuration for creating/editing connections
export interface ConnectionConfig extends Omit<Connection, 'id' | 'status' | 'createdAt' | 'lastUsed'> {
  // All Connection fields except id and status fields
}

// Connection Response from backend
export interface ConnectionResponse {
  message: string;
  connection?: Connection;
  timestamp?: string;
}

// Database Statistics
export interface DatabaseStats {
  name: string;
  sizeOnDisk: number;
  tables: { name: string }[];
  views: { name: string }[];
  error?: string; // For databases with access issues
}

// Enhanced Table Information
export interface TableInfo {
  db_name: string;
  table_name: string;
  columns: {
    column_name: string;
    data_type?: string;
    is_nullable?: boolean;
    default_value?: any;
    extra?: string;
    data_length?: number;
    is_primary_key?: boolean;
  }[];
  indexes: {
    index_name: string;
    is_unique?: boolean;
    type?: string;
    column_name?: string;
    definition?: string;
    origin?: string;
  }[];
  foreign_keys: {
    fk_name: string;
    column_name?: string;
    referenced_table?: string;
    referenced_column?: string;
    definition?: string;
    referenced_constraint?: string;
    delete_rule?: string;
    table_name?: string;
  }[];
  triggers: {
    trigger_name: string;
    event?: string;
    timing?: string;
    trigger_type?: string;
    triggering_event?: string;
    status?: string;
    definition?: string;
    sql?: string;
    is_disabled?: boolean;
  }[];
}

// Multiple Tables Information Response
export interface MultipleTablesInfo {
  tables: TableInfo[];
}

// Query Execution Result
export interface QueryMessage {
  query: string;
  message: string;
  type?: string;
  affectedRows?: number;
  insertId?: number | null;
  warningCount?: number;
}

export interface QueryPagination {
  page: number;
  pageSize: number;
  totalPages: number | null;
  hasMore?: boolean;
}

export interface QueryResultItem {
  type: string;                 // SELECT / SHOW / INSERT / ...
  query: string;                // original statement text
  rows: any[];                  // result rows (empty for non-SELECT)
  totalRows: number;            // total rows for the statement
  messages: QueryMessage[];     // statement-specific messages
  pagination?: QueryPagination; // per-statement pagination
}

export interface QueryResultMulti {
  queries: QueryResultItem[];
  totalQueries: number;
  executedAt: string;
}

export type QueryResult = QueryResultMulti; // or union with legacy single shape if you still need it


// Query Message
export interface QueryMessage {
  query: string;
  message: string;
  affectedRows?: number;
  insertId?: number | null;
  lastInsertId?: number | null;
  warningCount?: number;
  type?: string;
}

// Batch Query Result
export interface BatchQueryResult {
  results: QueryResult[];
  totalQueries: number;
  executedAt: string;
  mode: 'batch' | 'transaction';
  success: boolean;
}

// Query Analysis
export interface QueryAnalysis {
  type: string;
  isReadOnly: boolean;
  requiresTransaction: boolean;
  supportsPagination: boolean;
  queryLength?: number;
}

// Connection Health
export interface ConnectionHealth {
  status: 'healthy' | 'unhealthy';
  connected?: boolean;
  dbType?: string;
  connectionInfo?: any;
  activeConnections?: number;
  error?: string;
  timestamp: string;
  health?: any;
}

// Database Metadata for AI
export interface DbMeta {
  tableName: string;
  columns: string[];
  relationships?: string[];
}

// OpenAI Integration
export interface OpenAIPrompt {
  dbMeta: DbMeta[];
  databaseName: string;
  prompt: string;
}

export interface ConfigData {
  AI_MODEL: string;
  AI_API_KEY: string;
  AI_PROVIDER: string;
  PORT: number;
  DBFUSE_USERNAME: string;
  DBFUSE_PASSWORD: string;
}

export interface SaveResponse {
  message: string;
  requiresRestart?: boolean;
  newPort?: number;
}

export interface ModelOption {
  provider: string;
  models: string[];
}

export interface OpenAIPromptResponse {
  query: string;
  explanation?: string;
  confidence?: number;
  suggestions?: string[];
}

// Query Options
export interface QueryOptions {
  page?: number;
  pageSize?: number;
  timeout?: number;
  analyze?: boolean;
}

// Connection Statistics
export interface ConnectionStats {
  totalConnections?: number;
  activeConnections?: number;
  idleConnections?: number;
  poolTotal?: number;
  poolIdle?: number;
  poolWaiting?: number;
  poolConnected?: boolean;
  poolConnecting?: boolean;
  databaseName?: string;
  tableCount?: number;
  indexCount?: number;
  viewCount?: number;
  isMemoryDb?: boolean;
  totalSessions?: number;
  activeSessions?: number;
  inactiveSessions?: number;
  poolConnections?: number;
}

// Error Response
export interface ErrorResponse {
  error: string;
  timestamp?: string;
  details?: any;
}

// API Response Wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
  status?: number;
}

// Connection Validation Result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Database Schema Information
export interface SchemaInfo {
  databases: DatabaseStats[];
  currentDatabase?: string;
  connectionInfo?: Connection;
  retrievedAt: string;
}

// Table Schema for detailed view
export interface TableSchema extends TableInfo {
  rowCount?: number;
  estimatedSize?: number;
  lastModified?: string;
  engine?: string;
  collation?: string;
  comment?: string;
}

// View Information
export interface ViewInfo {
  view_name: string;
  definition: string;
  is_updatable?: boolean;
  check_option?: string;
  definer?: string;
  security_type?: string;
}

// Procedure Information
export interface ProcedureInfo {
  procedure_name: string;
  routine_type: string;
  data_type?: string;
  routine_definition?: string;
  is_deterministic?: boolean;
  sql_data_access?: string;
  security_type?: string;
  definer?: string;
  created?: string;
  modified?: string;
}

// Export all types
export {
  // Re-export commonly used types for backward compatibility
  Connection as ConnectionData,
  ConnectionConfig as NewConnection,
  TableInfo as TableData,
  QueryResult as QueryResponse
};