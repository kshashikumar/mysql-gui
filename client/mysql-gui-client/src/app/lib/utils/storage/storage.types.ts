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

export interface Column {
    column_name: string;
    column_key: 'PRI' | 'UNI' | 'MUL' | '';
    data_type: string;
    column_type: string;
    is_nullable: 'YES' | 'NO';
    column_default: string | null;
    extra: string;
    ordinal_position: number;
    character_maximum_length: number | null;
    numeric_precision: number | null;
    numeric_scale: number | null;
}

export interface IndexColumn {
    index_name: string;
    column_name: string;
    seq_in_index: number;
    non_unique: number;
}

export interface ForeignKey {
    fk_name: string;
}

export interface Trigger {
    trigger_name: string;
}

export interface TableInfo {
    db_name: string;
    table_name: string;
    columns: Column[];
    indexes: IndexColumn[];
    foreign_keys: ForeignKey[];
    triggers: Trigger[];
}

export interface IndTableInfo {
    table_name: string;
    columns: Column[];
    indexes: IndexColumn[];
    foreign_keys: ForeignKey[];
    triggers: Trigger[];
}

export interface MultipleTablesInfo {
    tables: IndTableInfo[];
}

// Column definition used when creating / altering tables (DDL requests).
export interface ColumnDef {
    name: string;
    type: string;
    nullable?: boolean;
    default?: any;
    defaultRaw?: boolean;
    autoIncrement?: boolean;
    pk?: boolean;
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

// ---- Row CRUD requests / results (Phase 1) ----
export interface InsertRowRequest {
    table: string;
    rows: Record<string, any>[];
}

export interface UpdateRowRequest {
    table: string;
    pkColumns: string[];
    pkValues: any[];
    values: Record<string, any>;
}

export interface DeleteRowRequest {
    table: string;
    pkColumns: string[];
    pkValues: any[];
}

export interface RowWriteResult {
    affectedRows: number;
    insertId?: number | null;
}

// ---- DDL requests / results (Phase 2) ----
export interface CreateTableRequest {
    table: string;
    columns: ColumnDef[];
    engine?: string;
}

export interface CreateDatabaseRequest {
    database: string;
    charset?: string;
    collation?: string;
}

export interface DdlResult {
    affectedRows: number;
    message: string;
}
