// src/app/landing/landing.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ConnectionListComponent, LayoutHorizontalComponent, NavbarComponent } from '@lib/components';
import { ConnectionModalComponent } from '@lib/components/connection-modal/connection-modal.component';
import { ConfirmationDialogComponent } from '@lib/components/confirmation-dialog/confirmation-dialog.component';
import { AuthService, BackendService } from '@lib/services';
import { ConnectionService } from '@lib/services/backend';
import { LogoComponent } from '@lib/components/logo/logo.component';
import { Connection, ConnectionConfig, DatabaseType } from '@lib/utils/storage/storage.types';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LayoutHorizontalComponent,
    ConnectionListComponent,
    ConnectionModalComponent,
    ConfirmationDialogComponent,
    LogoComponent,
    NavbarComponent
  ],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  connections: Connection[] = [];
  isModalOpen = false;
  isConfirmDialogOpen = false;
  selectedConnection: ConnectionConfig | null = null;
  connectionToDelete: number | null = null;
  loading = false;
  error: string | null = null;
  testSuccessMessage: string | null = null;
  loadingMessage: string | null = null;

  constructor(
    private backendService: BackendService,
    private _authService: AuthService,
    private connectionService: ConnectionService,
    private router: Router
  ) {
    sessionStorage.removeItem('dbType'); // Clear dbType on landing page
    this.backendService.clearDatabaseType();
  }

  ngOnInit(): void {
    this.loadConnections();
  }

  loadConnections(): void {
    this.loading = true;
    this.error = null;
    this.loadingMessage = 'Loading connections...';
    
    this.connectionService.getConnections().subscribe({
      next: (data) => {
        console.log('Connections loaded:', data);
        this.connections = data.connections || [];
        this.loading = false;
        this.loadingMessage = null;
      },
      error: (err) => {
        console.error('Error fetching connections:', err);
        this.error = 'Failed to load connections';
        this.loading = false;
        this.loadingMessage = null;
      },
    });
  }

  logout() {
    console.log("Logging out...");
    sessionStorage.clear();
    this.backendService.clearDatabaseType();
    this._authService.logout().subscribe({
      next: () => {
        console.log("Logout successful");
        this.router.navigate(['/login'], { replaceUrl: true });
      },
      error: (err) => {
        console.error("Logout failed:", err);
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }

  openAddModal(): void {
    this.selectedConnection = {
      username: '',
      password: '',
      host: 'localhost',
      port: 3306,
      dbType: 'mysql2',
      database: '',
      socketPath: '',
    };
    this.isModalOpen = true;
  }

  openEditModal(connection: Connection): void {
    // Convert Connection to ConnectionConfig for editing
    const { id, status, createdAt, lastUsed, ...configData } = connection;
    this.selectedConnection = { ...configData };
    // Store the ID for update operation
    (this.selectedConnection as any).id = id;
    this.isModalOpen = true;
  }

  saveConnection(connection: ConnectionConfig & { id?: number }): void {
    // Enhanced validation
    const validation = this.connectionService.validateConnectionConfig(connection);
    if (!validation.isValid) {
      console.error('Validation errors:', validation.errors);
      this.error = validation.errors.join(', ');
      return;
    }

    this.loading = true;
    this.error = null;
    this.testSuccessMessage = null;
    this.loadingMessage = connection.id ? 'Updating connection...' : 'Adding connection...';

    if (connection.id) {
      // Edit existing connection
      this.connectionService.editConnection(connection.id, connection).subscribe({
        next: (response) => {
          console.log('Connection updated:', response.message);
          this.loadConnections();
          this.isModalOpen = false;
          this.loading = false;
          this.loadingMessage = null;
        },
        error: (err) => {
          console.error('Error updating connection:', err);
          this.error = 'Failed to update connection';
          this.loading = false;
          this.loadingMessage = null;
        },
      });
    } else {
      // Add new connection
      this.connectionService.addConnection(connection).subscribe({
        next: (response) => {
          console.log('Connection added:', response.message);
          this.loadConnections();
          this.isModalOpen = false;
          this.loading = false;
          this.loadingMessage = null;
        },
        error: (err) => {
          console.error('Error adding connection:', err);
          this.error = 'Failed to add connection';
          this.loading = false;
          this.loadingMessage = null;
        },
      });
    }
  }

  openDeleteDialog(id: number | string): void {
    this.connectionToDelete = typeof id === 'string' ? parseInt(id) : id;
    this.isConfirmDialogOpen = true;
  }

  confirmDelete(): void {
    if (this.connectionToDelete) {
      this.loading = true;
      this.error = null;
      this.testSuccessMessage = null;
      this.loadingMessage = 'Deleting connection...';

      this.connectionService.deleteConnection(this.connectionToDelete).subscribe({
        next: (response) => {
          console.log('Connection deleted:', response.message);
          this.loadConnections();
          this.isConfirmDialogOpen = false;
          this.connectionToDelete = null;
          this.loading = false;
          this.loadingMessage = null;
        },
        error: (err) => {
          console.error('Error deleting connection:', err);
          this.error = 'Failed to delete connection';
          this.loading = false;
          this.loadingMessage = null;
        },
      });
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedConnection = null;
    this.error = null;
  }

  closeConfirmDialog(): void {
    this.isConfirmDialogOpen = false;
    this.connectionToDelete = null;
  }

  onConnectionSelect(connection: Connection): void {
    console.log('Connecting to server:', connection);
    this.loading = true;
    this.error = null;
    this.testSuccessMessage = null;
    this.loadingMessage = 'Connecting to database...';
    
    // Convert Connection to ConnectionConfig for backend
    const { id, status, createdAt, lastUsed, ...connectionConfig } = connection;
    
    // Ensure dbType is properly typed
    const typedConnectionConfig: ConnectionConfig = {
      ...connectionConfig,
      dbType: connectionConfig.dbType as DatabaseType
    };
    
    this.backendService.connect(typedConnectionConfig).subscribe({
      next: (response) => {
        console.log('Connection successful:', response.message);
        sessionStorage.setItem('connection', JSON.stringify(connection));
        this.loading = false;
        this.loadingMessage = null;
        this.router.navigate(['/connection'], { state: { connection } });
      },
      error: (err) => {
        console.error('Error connecting to database:', err);
        this.error = `Connection failed: ${err.error?.error || err.message}`;
        this.loading = false;
        this.loadingMessage = null;
      },
    });
  }

  // Enhanced test connection method with proper error handling and UI feedback
  testConnection(connection: Connection): void {
    console.log('Testing connection:', connection);

    // Validate connection configuration before testing
    if (!this.connectionService.canTestConnection(connection)) {
      this.error = 'Connection configuration is invalid for testing';
      this.testSuccessMessage = null;
      return;
    }

    // Clear previous messages
    this.error = null;
    this.testSuccessMessage = null;
    this.loading = true;
    this.loadingMessage = `Testing connection to ${this.connectionService.getConnectionDisplayName(connection)}...`;

    // Ensure connection ID is properly typed
    const connectionId = typeof connection.id === 'string' ? parseInt(connection.id) : connection.id;
    
    if (!connectionId || isNaN(connectionId)) {
      this.error = 'Invalid connection ID for testing';
      this.loading = false;
      this.loadingMessage = null;
      return;
    }

    this.connectionService.testConnection(connectionId).subscribe({
      next: (response) => {
        console.log('Connection test successful:', response);
        this.testSuccessMessage = ` Connection test successful! ${response.message || 'Database is reachable.'}`;
        this.loading = false;
        this.loadingMessage = null;

        // Optionally update the connection's last tested time or status
        if (response.connection) {
          // Find and update the connection in the local array
          const index = this.connections.findIndex(conn => conn.id === connectionId);
          if (index !== -1) {
            this.connections[index] = { ...this.connections[index], ...response.connection };
          }
        }

        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          this.testSuccessMessage = null;
        }, 5000);
      },
      error: (err) => {
        console.error('Connection test failed:', err);
        this.error = `❌ Connection test failed: ${err.error?.error || err.error?.message || err.message || 'Unknown error'}`;
        this.loading = false;
        this.loadingMessage = null;

        // Auto-hide error message after 10 seconds
        setTimeout(() => {
          this.error = null;
        }, 10000);
      },
    });
  }

  // Get connection display name for UI
  getConnectionDisplayName(connection: Connection): string {
    return this.connectionService.getConnectionDisplayName(connection);
  }

  // Sort connections
  sortConnections(sortBy: 'name' | 'type' | 'recent' | 'created'): void {
    this.connections = this.connectionService.sortConnections(this.connections, sortBy);
  }

  // Check if connection was recently used
  isRecentlyUsed(connection: Connection): boolean {
    return this.connectionService.isRecentlyUsed(connection);
  }

  // Clear all messages
  clearMessages(): void {
    this.error = null;
    this.testSuccessMessage = null;
  }

  // Handle connection status updates after test
  private updateConnectionStatus(connectionId: number, status: Partial<Connection>): void {
    const index = this.connections.findIndex(conn => conn.id === connectionId);
    if (index !== -1) {
      this.connections[index] = { ...this.connections[index], ...status };
    }
  }
}