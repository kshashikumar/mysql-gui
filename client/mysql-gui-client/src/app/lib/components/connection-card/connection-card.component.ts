import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-connection-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connection-card.component.html',
})
export class ConnectionCardComponent {
  @Input() connection!: { 
    id: string; 
    username: string; 
    password: string; 
    host: string; 
    port: number; 
    dbType: string; 
    database?: string; 
    socketPath?: string; 
    status?: string 
  };
  
  @Output() onSelect = new EventEmitter<{ 
    id: string; 
    username: string; 
    password: string; 
    host: string; 
    port: number; 
    dbType: string; 
    database?: string; 
    socketPath?: string 
  }>();
  
  @Output() onEdit = new EventEmitter<{ 
    id: string; 
    username: string; 
    password: string; 
    host: string; 
    port: number; 
    dbType: string; 
    database?: string; 
    socketPath?: string 
  }>();
  
  @Output() onDelete = new EventEmitter<string>();

  constructor(private router: Router) {}

  onSelectConnection() {
    this.onSelect.emit(this.connection);
  }

  onEditConnection() {
    this.onEdit.emit(this.connection);
  }

  onDeleteConnection() {
    this.onDelete.emit(this.connection.id);
  }

  getStatusColor(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'connected':
        return 'bg-green-400 dark:bg-green-500';
      case 'connecting':
        return 'bg-yellow-400 dark:bg-yellow-500';
      case 'error':
      case 'failed':
        return 'bg-red-400 dark:bg-red-500';
      default:
        return 'bg-gray-400 dark:bg-gray-500';
    }
  }

  getStatusTextColor(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'connected':
        return 'text-green-700 dark:text-green-400';
      case 'connecting':
        return 'text-yellow-700 dark:text-yellow-400';
      case 'error':
      case 'failed':
        return 'text-red-700 dark:text-red-400';
      default:
        return 'text-gray-700 dark:text-gray-400';
    }
  }

  getStatusText(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Disconnected';
    }
  }
}