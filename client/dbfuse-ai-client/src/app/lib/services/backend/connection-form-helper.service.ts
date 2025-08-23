import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ConnectionConfig, DatabaseType, ValidationResult } from '@lib/utils/storage/storage.types';

@Injectable({
  providedIn: 'root'
})
export class ConnectionFormHelper {

  constructor(private fb: FormBuilder) {}

  // Create a reactive form for connection configuration
  createConnectionForm(connection?: Partial<ConnectionConfig>): FormGroup {
    const form = this.fb.group({
      // Basic fields
      username: [connection?.username || '', [Validators.minLength(1)]],
      password: [connection?.password || ''],
      host: [connection?.host || 'localhost', [this.hostnameValidator]],
      port: [connection?.port || this.getDefaultPort(connection?.dbType), [
        Validators.min(1), 
        Validators.max(65535)
      ]],
      dbType: [connection?.dbType || 'mysql2', [Validators.required]],
      database: [connection?.database || ''], // No validators initially
      socketPath: [connection?.socketPath || ''],

      // Security options
      ssl: [connection?.ssl || false],
      encrypt: [connection?.encrypt || false],
      trustServerCertificate: [connection?.trustServerCertificate || false],

      // Connection options
      connectionTimeout: [connection?.connectionTimeout || 60000, [
        Validators.min(1000), 
        Validators.max(300000)
      ]],
      poolSize: [connection?.poolSize || 10, [Validators.min(1), Validators.max(100)]],

      // MySQL specific
      charset: [connection?.charset || 'UTF8_GENERAL_CI'],
      timezone: [connection?.timezone || 'local'],
      acquireTimeout: [connection?.acquireTimeout],
      waitForConnections: [connection?.waitForConnections !== false],
      queueLimit: [connection?.queueLimit || 0],
      reconnect: [connection?.reconnect !== false],
      idleTimeout: [connection?.idleTimeout || 30000],

      // PostgreSQL specific
      maxConnections: [connection?.maxConnections],
      statement_timeout: [connection?.statement_timeout || 0],
      query_timeout: [connection?.query_timeout || 0],
      application_name: [connection?.application_name || 'dbfuse-ai-App'],
      schema: [connection?.schema || 'public'],

      // MSSQL specific
      instanceName: [connection?.instanceName || ''],
      domain: [connection?.domain || ''],
      requestTimeout: [connection?.requestTimeout || 30000],
      cancelTimeout: [connection?.cancelTimeout || 5000],
      packetSize: [connection?.packetSize],
      appName: [connection?.appName || 'dbfuse-ai-App'],

      // Oracle specific
      serviceName: [connection?.serviceName || ''],
      sid: [connection?.sid || ''],
      walletLocation: [connection?.walletLocation || ''],
      walletPassword: [connection?.walletPassword || ''],
      edition: [connection?.edition || ''],
      privilege: [connection?.privilege || ''],
      externalAuth: [connection?.externalAuth || false],
      poolMin: [connection?.poolMin || 2],
      poolTimeout: [connection?.poolTimeout || 30],

      // SQLite specific
      mode: [connection?.mode || ''],
      verbose: [connection?.verbose || false],
      busyTimeout: [connection?.busyTimeout],
      cacheSize: [connection?.cacheSize],
      pageSize: [connection?.pageSize],
      journalMode: [connection?.journalMode || 'WAL'],
      synchronous: [connection?.synchronous || 'NORMAL'],
      tempStore: [connection?.tempStore || ''],
      lockingMode: [connection?.lockingMode || ''],
      foreignKeys: [connection?.foreignKeys !== false],
      readOnly: [connection?.readOnly || false]
    });

    // Set up dynamic validation based on database type
    this.setupDynamicValidation(form);

    return form;
  }

  // Setup dynamic validation that changes based on database type
  private setupDynamicValidation(form: FormGroup): void {
    const dbTypeControl = form.get('dbType');
    const databaseControl = form.get('database');

    if (dbTypeControl) {
      dbTypeControl.valueChanges.subscribe((dbType: DatabaseType) => {
        this.updateValidationForDbType(form, dbType);
        this.updateDefaultValues(form, dbType);
      });
    }

    // Ensure database field updates trigger form validation
    if (databaseControl) {
      databaseControl.valueChanges.subscribe(() => {
        databaseControl.updateValueAndValidity({ emitEvent: false });
      });
    }
  }

  // Update validation rules based on database type
  private updateValidationForDbType(form: FormGroup, dbType: DatabaseType): void {
    const databaseControl = form.get('database');
    const hostControl = form.get('host');
    const usernameControl = form.get('username');
    const passwordControl = form.get('password');
    const portControl = form.get('port');

    // Clear existing validators
    databaseControl?.clearValidators();
    hostControl?.clearValidators();
    usernameControl?.clearValidators();
    passwordControl?.clearValidators();
    portControl?.clearValidators();

    // Apply database-specific validation
    switch (dbType) {
      case 'sqlite3':
        databaseControl?.setValidators([Validators.required, Validators.minLength(1)]);
        // SQLite doesn't need host, username, password, or port
        portControl?.setValidators([]); // Explicitly clear port validators
        break;
      
      case 'mysql2':
        hostControl?.setValidators([Validators.required, this.hostnameValidator]);
        usernameControl?.setValidators([Validators.required, Validators.minLength(1)]);
        passwordControl?.setValidators([Validators.required]);
        portControl?.setValidators([Validators.required, Validators.min(1), Validators.max(65535)]);
        break;
      
      case 'pg':
        hostControl?.setValidators([Validators.required, this.hostnameValidator]);
        usernameControl?.setValidators([Validators.required, Validators.minLength(1)]);
        passwordControl?.setValidators([Validators.required]);
        databaseControl?.setValidators([Validators.required]);
        portControl?.setValidators([Validators.required, Validators.min(1), Validators.max(65535)]);
        break;
      
      case 'mssql':
        hostControl?.setValidators([Validators.required, this.hostnameValidator]);
        usernameControl?.setValidators([Validators.required, Validators.minLength(1)]);
        passwordControl?.setValidators([Validators.required]);
        portControl?.setValidators([Validators.required, Validators.min(1), Validators.max(65535)]);
        break;
      
      case 'oracledb':
        hostControl?.setValidators([Validators.required, this.hostnameValidator]);
        usernameControl?.setValidators([Validators.required, Validators.minLength(1)]);
        passwordControl?.setValidators([Validators.required]);
        portControl?.setValidators([Validators.required, Validators.min(1), Validators.max(65535)]);
        break;
    }

    // Update validity for all controls
    [databaseControl, hostControl, usernameControl, passwordControl, portControl].forEach(control => {
      control?.updateValueAndValidity({ emitEvent: false });
    });
  }

  // Update default values when database type changes
  private updateDefaultValues(form: FormGroup, dbType: DatabaseType): void {
    const portControl = form.get('port');
    const databaseControl = form.get('database');
    
    // Update port default
    if (portControl && !portControl.dirty) {
      portControl.setValue(this.getDefaultPort(dbType), { emitEvent: false });
    }

    // Update database default
    if (databaseControl && !databaseControl.dirty) {
      const defaultDb = this.getDefaultDatabase(dbType);
      if (defaultDb !== null) {
        databaseControl.setValue(defaultDb, { emitEvent: false });
      }
    }
  }

  // Get default port for database type
  private getDefaultPort(dbType?: DatabaseType): number {
    const ports: Record<DatabaseType, number> = {
      mysql2: 3306,
      pg: 5432,
      mssql: 1433,
      oracledb: 1521,
      sqlite3: 0 // Not applicable
    };
    return dbType ? ports[dbType] : 3306;
  }

  // Get default database for database type
  private getDefaultDatabase(dbType: DatabaseType): string | null {
    const defaults: Record<DatabaseType, string | null> = {
      mysql2: '',
      pg: 'postgres',
      mssql: 'master',
      oracledb: 'XE',
      sqlite3: './data/database.db'
    };
    return defaults[dbType];
  }

  // Custom hostname validator
  private hostnameValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    // Allow localhost, IP addresses, and domain names
    const hostnameRegex = /^(localhost|(\d{1,3}\.){3}\d{1,3}|([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)$/;
    
    if (!hostnameRegex.test(value)) {
      return { invalidHostname: true };
    }
    
    return null;
  }

  // Get form fields relevant to specific database type
  getRelevantFields(dbType: DatabaseType): string[] {
    const commonFields = ['username', 'password', 'host', 'port', 'dbType', 'database', 'ssl', 'connectionTimeout', 'poolSize'];
    
    const specificFields: Record<DatabaseType, string[]> = {
      mysql2: [...commonFields, 'socketPath', 'charset', 'timezone', 'acquireTimeout', 'waitForConnections', 'queueLimit', 'reconnect', 'idleTimeout'],
      pg: [...commonFields, 'maxConnections', 'statement_timeout', 'query_timeout', 'application_name', 'schema'],
      mssql: [...commonFields, 'encrypt', 'trustServerCertificate', 'instanceName', 'domain', 'requestTimeout', 'cancelTimeout', 'packetSize', 'appName'],
      oracledb: [...commonFields, 'serviceName', 'sid', 'walletLocation', 'walletPassword', 'edition', 'privilege', 'externalAuth', 'poolMin', 'poolTimeout'],
      sqlite3: ['dbType', 'database', 'mode', 'verbose', 'busyTimeout', 'cacheSize', 'pageSize', 'journalMode', 'synchronous', 'tempStore', 'lockingMode', 'foreignKeys', 'readOnly']
    };
    
    return specificFields[dbType] || commonFields;
  }

  // Validate connection configuration
  validateConnection(config: ConnectionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!config.dbType) {
      errors.push('Database type is required');
    }

    // Database-specific validation
    switch (config.dbType) {
      case 'sqlite3':
        if (!config.database || config.database.trim() === '') {
          errors.push('Database file path is required for SQLite');
        }
        break;

      case 'mysql2':
      case 'pg':
      case 'mssql':
      case 'oracledb':
        if (!config.username) errors.push('Username is required');
        if (!config.password) errors.push('Password is required');
        if (!config.host) errors.push('Host is required');
        if (!config.port || config.port < 1 || config.port > 65535) {
          errors.push('Valid port number is required (1-65535)');
        }
        break;
    }

    // PostgreSQL specific
    if (config.dbType === 'pg' && !config.database) {
      errors.push('Database name is required for PostgreSQL');
    }

    // Timeout validation
    if (config.connectionTimeout && (config.connectionTimeout < 1000 || config.connectionTimeout > 300000)) {
      warnings.push('Connection timeout should be between 1000ms and 300000ms');
    }

    // Pool size validation
    if (config.poolSize && (config.poolSize < 1 || config.poolSize > 100)) {
      warnings.push('Pool size should be between 1 and 100');
    }

    // SSL warnings
    if (config.host !== 'localhost' && !config.ssl && config.dbType !== 'sqlite3') {
      warnings.push('Consider enabling SSL for remote connections');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Get form configuration for UI rendering
  getFormConfig(dbType: DatabaseType): FormFieldConfig[] {
    const configs: Record<DatabaseType, FormFieldConfig[]> = {
      mysql2: [
        { name: 'username', label: 'Username', type: 'text', required: true, group: 'basic' },
        { name: 'password', label: 'Password', type: 'password', required: true, group: 'basic' },
        { name: 'host', label: 'Host', type: 'text', required: true, group: 'basic' },
        { name: 'port', label: 'Port', type: 'number', required: true, group: 'basic' },
        { name: 'database', label: 'Database', type: 'text', required: false, group: 'basic' },
        { name: 'socketPath', label: 'Socket Path', type: 'text', required: false, group: 'advanced' },
        { name: 'ssl', label: 'Enable SSL', type: 'checkbox', required: false, group: 'security' },
        { name: 'connectionTimeout', label: 'Connection Timeout (ms)', type: 'number', required: false, group: 'advanced' },
        { name: 'poolSize', label: 'Pool Size', type: 'number', required: false, group: 'advanced' },
        { name: 'charset', label: 'Charset', type: 'select', options: ['UTF8_GENERAL_CI', 'UTF8MB4_UNICODE_CI'], group: 'advanced' },
        { name: 'timezone', label: 'Timezone', type: 'text', group: 'advanced' },
        { name: 'waitForConnections', label: 'Wait for Connections', type: 'checkbox', group: 'advanced' },
        { name: 'reconnect', label: 'Auto Reconnect', type: 'checkbox', group: 'advanced' }
      ],
      
      pg: [
        { name: 'username', label: 'Username', type: 'text', required: true, group: 'basic' },
        { name: 'password', label: 'Password', type: 'password', required: true, group: 'basic' },
        { name: 'host', label: 'Host', type: 'text', required: true, group: 'basic' },
        { name: 'port', label: 'Port', type: 'number', required: true, group: 'basic' },
        { name: 'database', label: 'Database', type: 'text', required: true, group: 'basic' },
        { name: 'ssl', label: 'Enable SSL', type: 'checkbox', required: false, group: 'security' },
        { name: 'connectionTimeout', label: 'Connection Timeout (ms)', type: 'number', group: 'advanced' },
        { name: 'poolSize', label: 'Pool Size', type: 'number', group: 'advanced' },
        { name: 'maxConnections', label: 'Max Connections', type: 'number', group: 'advanced' },
        { name: 'application_name', label: 'Application Name', type: 'text', group: 'advanced' },
        { name: 'schema', label: 'Schema', type: 'text', group: 'advanced' }
      ],

      sqlite3: [
        { name: 'database', label: 'Database File Path', type: 'text', required: true, group: 'basic', placeholder: './data/database.db' },
        { name: 'readOnly', label: 'Read Only', type: 'checkbox', group: 'basic' },
        { name: 'journalMode', label: 'Journal Mode', type: 'select', options: ['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF'], group: 'advanced' },
        { name: 'synchronous', label: 'Synchronous Mode', type: 'select', options: ['OFF', 'NORMAL', 'FULL', 'EXTRA'], group: 'advanced' },
        { name: 'foreignKeys', label: 'Enable Foreign Keys', type: 'checkbox', group: 'advanced' },
        { name: 'busyTimeout', label: 'Busy Timeout (ms)', type: 'number', group: 'advanced' },
        { name: 'cacheSize', label: 'Cache Size', type: 'number', group: 'advanced' },
        { name: 'pageSize', label: 'Page Size', type: 'number', group: 'advanced' }
      ],

      mssql: [
        { name: 'username', label: 'Username', type: 'text', required: true, group: 'basic' },
        { name: 'password', label: 'Password', type: 'password', required: true, group: 'basic' },
        { name: 'host', label: 'Host', type: 'text', required: true, group: 'basic' },
        { name: 'port', label: 'Port', type: 'number', required: true, group: 'basic' },
        { name: 'database', label: 'Database', type: 'text', group: 'basic' },
        { name: 'instanceName', label: 'Instance Name', type: 'text', group: 'basic' },
        { name: 'encrypt', label: 'Encrypt Connection', type: 'checkbox', group: 'security' },
        { name: 'trustServerCertificate', label: 'Trust Server Certificate', type: 'checkbox', group: 'security' },
        { name: 'domain', label: 'Domain', type: 'text', group: 'security' },
        { name: 'connectionTimeout', label: 'Connection Timeout (ms)', type: 'number', group: 'advanced' },
        { name: 'requestTimeout', label: 'Request Timeout (ms)', type: 'number', group: 'advanced' },
        { name: 'poolSize', label: 'Pool Size', type: 'number', group: 'advanced' }
      ],

      oracledb: [
        { name: 'username', label: 'Username', type: 'text', required: true, group: 'basic' },
        { name: 'password', label: 'Password', type: 'password', required: true, group: 'basic' },
        { name: 'host', label: 'Host', type: 'text', required: true, group: 'basic' },
        { name: 'port', label: 'Port', type: 'number', required: true, group: 'basic' },
        { name: 'database', label: 'Database/SID', type: 'text', group: 'basic' },
        { name: 'serviceName', label: 'Service Name', type: 'text', group: 'basic' },
        { name: 'sid', label: 'SID', type: 'text', group: 'basic' },
        { name: 'edition', label: 'Edition', type: 'text', group: 'advanced' },
        { name: 'privilege', label: 'Privilege', type: 'select', options: ['SYSDBA', 'SYSOPER'], group: 'security' },
        { name: 'connectionTimeout', label: 'Connection Timeout (ms)', type: 'number', group: 'advanced' },
        { name: 'poolSize', label: 'Pool Size', type: 'number', group: 'advanced' },
        { name: 'poolTimeout', label: 'Pool Timeout (s)', type: 'number', group: 'advanced' }
      ]
    };

    return configs[dbType] || configs.mysql2;
  }

  // Convert form value to connection config
  formToConnectionConfig(formValue: any): ConnectionConfig {
    // Remove empty/null values and convert to proper types
    const config: any = {};
    
    Object.keys(formValue).forEach(key => {
      const value = formValue[key];
      if (value !== null && value !== undefined && value !== '') {
        // Convert string numbers to actual numbers for numeric fields
        const numericFields = ['port', 'connectionTimeout', 'poolSize', 'maxConnections', 'statement_timeout', 'query_timeout', 'requestTimeout', 'cancelTimeout', 'packetSize', 'poolMin', 'poolTimeout', 'busyTimeout', 'cacheSize', 'pageSize'];
        
        if (numericFields.includes(key) && typeof value === 'string') {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            config[key] = numValue;
          }
        } else {
          config[key] = value;
        }
      }
    });

    return config as ConnectionConfig;
  }
}

// Form field configuration interface
export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'checkbox' | 'select';
  required?: boolean;
  group: 'basic' | 'security' | 'advanced';
  options?: string[];
  placeholder?: string;
  hint?: string;
}