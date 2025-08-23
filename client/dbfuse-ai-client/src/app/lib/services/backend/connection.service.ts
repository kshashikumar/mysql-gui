import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Connection, ConnectionConfig, ConnectionResponse } from '@lib/utils/storage/storage.types';

@Injectable({
    providedIn: 'root',
})
export class ConnectionService {
    BASE_URL = environment.apiUrl;

    private getHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            Authorization: token ? token : '',
        });
    }

    constructor(private _http: HttpClient) {}

    // Get all connections
    getConnections(): Observable<{ 
        connections: Connection[], 
        count: number, 
        retrievedAt: string 
    }> {
        return this._http.get<{ 
            connections: Connection[], 
            count: number, 
            retrievedAt: string 
        }>(
            `${this.BASE_URL}/api/connections`, 
            { headers: this.getHeaders() }
        );
    }

    // Add a new connection with enhanced validation
    addConnection(connection: ConnectionConfig): Observable<{ 
        message: string, 
        connection: Connection 
    }> {
        return this._http.post<{ 
            message: string, 
            connection: Connection 
        }>(
            `${this.BASE_URL}/api/connections/add`, 
            connection, 
            { headers: this.getHeaders() }
        );
    }

    // Edit an existing connection
    editConnection(
        id: number, 
        updatedConnection: Partial<ConnectionConfig>
    ): Observable<{ 
        message: string, 
        connection: Connection 
    }> {
        return this._http.post<{ 
            message: string, 
            connection: Connection 
        }>(
            `${this.BASE_URL}/api/connections/edit/${id}`, 
            updatedConnection, 
            { headers: this.getHeaders() }
        );
    }

    // Delete a connection
    deleteConnection(id: number): Observable<{ 
        message: string, 
        deletedId: number, 
        deletedAt: string 
    }> {
        return this._http.delete<{ 
            message: string, 
            deletedId: number, 
            deletedAt: string 
        }>(
            `${this.BASE_URL}/api/connections/delete/${id}`, 
            { headers: this.getHeaders() }
        );
    }

    // Save multiple connections (bulk operation)
    saveConnections(connections: Connection[]): Observable<{ 
        message: string, 
        count: number, 
        savedAt: string 
    }> {
        return this._http.post<{ 
            message: string, 
            count: number, 
            savedAt: string 
        }>(
            `${this.BASE_URL}/api/connections/save-connections`, 
            { connections }, 
            { headers: this.getHeaders() }
        );
    }

    // Test a connection
    testConnection(id: number): Observable<{ 
        message: string, 
        connection: Partial<Connection>, 
        testedAt: string 
    }> {
        return this._http.post<{ 
            message: string, 
            connection: Partial<Connection>, 
            testedAt: string 
        }>(
            `${this.BASE_URL}/api/connections/test/${id}`, 
            {}, 
            { headers: this.getHeaders() }
        );
    }

    // Utility methods for connection management
    validateConnectionConfig(config: ConnectionConfig): { isValid: boolean, errors: string[] } {
        const errors: string[] = [];
        
        if (!config.dbType?.trim()) {
            errors.push('Database type is required');
        }

        const validDbTypes = ['mysql2', 'pg', 'sqlite3', 'mssql', 'oracledb'];
        if (config.dbType && !validDbTypes.includes(config.dbType)) {
            errors.push(`Database type must be one of: ${validDbTypes.join(', ')}`);
        }

        // Database-specific validation
        if (config.dbType === 'sqlite3') {
            if (!config.database?.trim()) {
                errors.push('Database file path is required for SQLite');
            }
        } else {
            // Non-SQLite databases require these fields
            if (!config.username?.trim()) {
                errors.push('Username is required');
            }
            if (!config.host?.trim()) {
                errors.push('Host is required');
            }
            if (!config.port || config.port <= 0 || config.port > 65535) {
                errors.push('Valid port number is required (1-65535)');
            }
            // PostgreSQL requires database
            if (config.dbType === 'pg' && !config.database?.trim()) {
                errors.push('Database name is required for PostgreSQL');
            }
        }

        // Validate optional numeric parameters
        if (config.connectionTimeout && (config.connectionTimeout < 1000 || config.connectionTimeout > 300000)) {
            errors.push('Connection timeout must be between 1000ms and 300000ms');
        }

        if (config.poolSize && (config.poolSize < 1 || config.poolSize > 100)) {
            errors.push('Pool size must be between 1 and 100');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Create default connection config based on database type
    createDefaultConfig(dbType: string): Partial<ConnectionConfig> {
        const defaults: Record<string, Partial<ConnectionConfig>> = {
            mysql2: {
                dbType: 'mysql2',
                host: 'localhost',
                port: 3306,
                database: '',
                username: '',
                password: '',
                ssl: false,
                connectionTimeout: 60000,
                poolSize: 10,
                charset: 'UTF8_GENERAL_CI',
                timezone: 'local'
            },
            pg: {
                dbType: 'pg',
                host: 'localhost',
                port: 5432,
                database: 'postgres',
                username: '',
                password: '',
                ssl: false,
                connectionTimeout: 60000,
                poolSize: 10,
                application_name: 'dbfuse-ai-App',
                schema: 'public'
            },
            sqlite3: {
                dbType: 'sqlite3',
                database: './data/database.db',
                journalMode: 'WAL',
                synchronous: 'NORMAL',
                foreignKeys: true
            },
            mssql: {
                dbType: 'mssql',
                host: 'localhost',
                port: 1433,
                database: 'master',
                username: '',
                password: '',
                encrypt: true,
                trustServerCertificate: true,
                connectionTimeout: 60000,
                poolSize: 10
            },
            oracledb: {
                dbType: 'oracledb',
                host: 'localhost',
                port: 1521,
                database: 'XE',
                username: '',
                password: '',
                connectionTimeout: 60000,
                poolSize: 10,
                poolTimeout: 30
            }
        };

        return defaults[dbType] || {};
    }

    // Get connection by ID
    getConnectionById(connections: Connection[], id: number): Connection | undefined {
        return connections.find(conn => conn.id === id);
    }

    // Check if connection has required fields for testing
    canTestConnection(connection: Connection): boolean {
        const config = this.validateConnectionConfig(connection);
        return config.isValid;
    }

    // Format connection display name
    getConnectionDisplayName(connection: Connection): string {
        if (connection.dbType === 'sqlite3') {
            return `${connection.database} (${connection.dbType})`;
        }
        const dbInfo = connection.database ? `/${connection.database}` : '';
        return `${connection.username}@${connection.host}:${connection.port}${dbInfo} (${connection.dbType})`;
    }

    // Get connections by database type
    getConnectionsByType(connections: Connection[], dbType: string): Connection[] {
        return connections.filter(conn => conn.dbType === dbType);
    }

    // Check if connection is recently used (within last 24 hours)
    isRecentlyUsed(connection: Connection): boolean {
        if (!connection.lastUsed) return false;
        
        const lastUsed = new Date(connection.lastUsed);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
        
        return hoursDiff <= 24;
    }

    // Sort connections by various criteria
    sortConnections(connections: Connection[], sortBy: 'name' | 'type' | 'recent' | 'created'): Connection[] {
        return [...connections].sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return this.getConnectionDisplayName(a).localeCompare(this.getConnectionDisplayName(b));
                case 'type':
                    return a.dbType.localeCompare(b.dbType);
                case 'recent':
                    const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
                    const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
                    return bTime - aTime; // Most recent first
                case 'created':
                    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bCreated - aCreated; // Most recent first
                default:
                    return 0;
            }
        });
    }
}