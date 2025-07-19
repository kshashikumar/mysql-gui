import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-connection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './connection-modal.component.html',
})
export class ConnectionModalComponent {
  @Input() isOpen: boolean = false;
  @Input() connection: { 
    id?: string; 
    username: string; 
    password: string; 
    host: string; 
    port: number; 
    dbType: string; 
    database?: string; 
    socketPath?: string 
  } = {
    username: '',
    password: '',
    host: '',
    port: 0,
    dbType: 'mysql2',
    database: '',
    socketPath: '',
  };

  @Output() onSave = new EventEmitter<{ 
    id?: string; 
    username: string; 
    password: string; 
    host: string; 
    port: number; 
    dbType: string; 
    database?: string; 
    socketPath?: string 
  }>();
  
  @Output() onCancel = new EventEmitter<void>();

  dbTypes = ['mysql2', 'pg', 'sqlite3', 'mssql', 'oracledb'];
  showPassword = false;

  getDbTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'mysql2': 'MySQL',
      'pg': 'PostgreSQL',
      'sqlite3': 'SQLite',
      'mssql': 'SQL Server',
      'oracledb': 'Oracle DB'
    };
    return labels[type] || type;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  isFormValid(): boolean {
    return !!(
      this.connection.host?.trim() &&
      this.connection.port &&
      this.connection.username?.trim() &&
      this.connection.dbType
    );
  }

  save() {
    if (this.isFormValid()) {
      // Set default port based on database type if not specified
      if (!this.connection.port) {
        const defaultPorts: { [key: string]: number } = {
          'mysql2': 3306,
          'pg': 5432,
          'sqlite3': 0,
          'mssql': 1433,
          'oracledb': 1521
        };
        this.connection.port = defaultPorts[this.connection.dbType] || 3306;
      }

      this.onSave.emit(this.connection);
    }
  }

  cancel() {
    this.onCancel.emit();
  }
}