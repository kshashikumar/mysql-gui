import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionCardComponent } from '@lib/components/connection-card/connection-card.component';
import { Connection } from '@lib/utils/storage/storage.types';

@Component({
  selector: 'app-connection-list',
  standalone: true,
  imports: [CommonModule, ConnectionCardComponent],
  templateUrl: './connection-list.component.html',
})
export class ConnectionListComponent {
  @Input() connections: Connection[] = [];
  
  @Output() onConnectionSelect = new EventEmitter<Connection>();
  @Output() onEdit = new EventEmitter<Connection>();
  @Output() onDelete = new EventEmitter<number>();
  @Output() onTest = new EventEmitter<Connection>();

  // Filter and sort state
  selectedDbType = '';
  selectedStatus = '';
  sortBy: 'name' | 'type' | 'recent' | 'created' = 'name';
  filteredConnections: Connection[] = [];

  ngOnInit(): void {
    this.updateFilteredConnections();
  }

  ngOnChanges(): void {
    this.updateFilteredConnections();
  }

  get availableDbTypes(): string[] {
    const types = [...new Set(this.connections.map(conn => conn.dbType))];
    return types.sort();
  }

  trackByConnectionId(index: number, connection: Connection): number | string {
    return connection.id;
  }

  onEditConnection(connection: Connection): void {
    this.onEdit.emit(connection);
  }

  onDeleteConnection(id: number | string): void {
    this.onDelete.emit(typeof id === 'string' ? parseInt(id) : id);
  }

  onTestConnection(connection: Connection): void {
    this.onTest.emit(connection);
  }

  onFilterChange(): void {
    this.updateFilteredConnections();
  }

  onSortChange(): void {
    this.updateFilteredConnections();
  }

  clearFilters(): void {
    this.selectedDbType = '';
    this.selectedStatus = '';
    this.updateFilteredConnections();
  }

  private updateFilteredConnections(): void {
    let filtered = [...this.connections];

    // Apply database type filter
    if (this.selectedDbType) {
      filtered = filtered.filter(conn => conn.dbType === this.selectedDbType);
    }

    // Apply status filter
    if (this.selectedStatus) {
      switch (this.selectedStatus) {
        case 'recent':
          filtered = filtered.filter(conn => this.isRecentlyUsed(conn));
          break;
        case 'available':
          filtered = filtered.filter(conn => !conn.status || conn.status.toLowerCase() === 'available');
          break;
        case 'connected':
          filtered = filtered.filter(conn => conn.status?.toLowerCase() === 'connected');
          break;
      }
    }

    // Apply sorting
    filtered = this.sortConnections(filtered, this.sortBy);

    this.filteredConnections = filtered;
  }

  private sortConnections(connections: Connection[], sortBy: string): Connection[] {
    return [...connections].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return this.getConnectionDisplayName(a).localeCompare(this.getConnectionDisplayName(b));
        case 'type':
          return a.dbType.localeCompare(b.dbType);
        case 'recent':
          const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          return bTime - aTime;
        case 'created':
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        default:
          return 0;
      }
    });
  }

  private getConnectionDisplayName(connection: Connection): string {
    const dbInfo = connection.database ? `/${connection.database}` : '';
    return `${connection.username}@${connection.host}:${connection.port}${dbInfo}`;
  }

  private isRecentlyUsed(connection: Connection): boolean {
    if (!connection.lastUsed) return false;
    const lastUsed = new Date(connection.lastUsed);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
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
}