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
    
    this.connectionService.getConnections().subscribe({
      next: (data) => {
        console.log('Connections loaded:', data);
        this.connections = data.connections || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching connections:', err);
        this.error = 'Failed to load connections';
        this.loading = false;
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

    if (connection.id) {
      // Edit existing connection
      this.connectionService.editConnection(connection.id, connection).subscribe({
        next: (response) => {
          console.log('Connection updated:', response.message);
          this.loadConnections();
          this.isModalOpen = false;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error updating connection:', err);
          this.error = 'Failed to update connection';
          this.loading = false;
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
        },
        error: (err) => {
          console.error('Error adding connection:', err);
          this.error = 'Failed to add connection';
          this.loading = false;
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
      this.connectionService.deleteConnection(this.connectionToDelete).subscribe({
        next: (response) => {
          console.log('Connection deleted:', response.message);
          this.loadConnections();
          this.isConfirmDialogOpen = false;
          this.connectionToDelete = null;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error deleting connection:', err);
          this.error = 'Failed to delete connection';
          this.loading = false;
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
        this.router.navigate(['/connection'], { state: { connection } });
      },
      error: (err) => {
        console.error('Error connecting to database:', err);
        this.error = `Connection failed: ${err.error?.error || err.message}`;
        this.loading = false;
      },
    });
  }

  // Test connection without navigating
  testConnection(connection: Connection): void {
    if (!this.connectionService.canTestConnection(connection)) {
      this.error = 'Connection configuration is invalid';
      return;
    }

    this.loading = true;
    const connectionId = typeof connection.id === 'string' ? parseInt(connection.id) : connection.id;
    this.connectionService.testConnection(connectionId).subscribe({
      next: (response) => {
        console.log('Connection test successful:', response.message);
        this.loading = false;
        // Update connection status or show success message
      },
      error: (err) => {
        console.error('Connection test failed:', err);
        this.error = `Connection test failed: ${err.error?.error || err.message}`;
        this.loading = false;
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
}