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
  @Input() connection: { id?: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string } = {
    username: '',
    password: '',
    host: '',
    port: 0,
    dbType: 'mysql2',
    database: '',
    socketPath: '',
  };
  @Output() onSave = new EventEmitter<{ id?: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }>();
  @Output() onCancel = new EventEmitter<void>();

  dbTypes = ['mysql2', 'pg', 'sqlite3', 'mssql', 'oracledb'];

  save() {
    this.onSave.emit(this.connection);
  }

  cancel() {
    this.onCancel.emit();
  }
}