import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Connection } from '@lib/utils/storage/storage.types';

@Component({
  selector: 'app-connection-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connection-card.component.html',
})
export class ConnectionCardComponent {
  @Input() connection!: Connection;
  
  @Output() onSelect = new EventEmitter<Connection>();
  @Output() onEdit = new EventEmitter<Connection>();
  @Output() onDelete = new EventEmitter<number>();
  @Output() onTest = new EventEmitter<Connection>();

  testing = false;
  connecting = false;
  isFavorite = false; // This could be stored in localStorage or user preferences

  onSelectConnection(): void {
    this.connecting = true;
    this.onSelect.emit(this.connection);
    // Reset connecting state after a timeout in case parent doesn't update
    setTimeout(() => { this.connecting = false; }, 5000);
  }

  onEditConnection(): void {
    this.onEdit.emit(this.connection);
  }

  onDeleteConnection(): void {
    this.onDelete.emit(typeof this.connection.id === 'string' ? parseInt(this.connection.id) : this.connection.id);
  }

  getFavoriteButtonClasses(): string {
    const baseClasses = 'flex-shrink-0 p-2 rounded-full text-gray-400 hover:text-yellow-500 transition-all duration-200';
    const hoverClasses = 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20';
    
    if (this.isFavorite) {
      return `${baseClasses} ${hoverClasses} text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20`;
    }
    
    return `${baseClasses} ${hoverClasses}`;
  }

  onTestConnection(): void {
    this.testing = true;
    this.onTest.emit(this.connection);
    // Reset testing state after a timeout
    setTimeout(() => { this.testing = false; }, 5000);
  }

  toggleFavorite(): void {
    this.isFavorite = !this.isFavorite;
    // Here you could emit an event to save favorites to localStorage or backend
  }

  getConnectionTitle(): string {
    if (this.connection.dbType === 'sqlite3') {
      return this.connection.database || 'SQLite Database';
    }
    return `${this.connection.host}:${this.connection.port}`;
  }

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
        return 'Available';
    }
  }

  isRecentlyUsed(): boolean {
    if (!this.connection.lastUsed) return false;
    const lastUsed = new Date(this.connection.lastUsed);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  }

  formatLastUsed(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }
}