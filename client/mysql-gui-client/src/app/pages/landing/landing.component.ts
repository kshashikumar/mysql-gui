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
  connections: { id: number; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string; status?: string }[] = [];
  isModalOpen = false;
  isConfirmDialogOpen = false;
  selectedConnection: { id?: number; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string; status?: string } | null = null;
  connectionToDelete: number | null = null;

  constructor(
    private backendService: BackendService,
    private _authService: AuthService,
    private connectionService: ConnectionService,
    private router: Router
  ) {
    sessionStorage.removeItem('dbType'); // Clear dbType on landing page
  }

  ngOnInit(): void {
    this.loadConnections();
  }

  loadConnections(): void {
    this.connectionService.getConnections().subscribe({
      next: (data) => {
        console.log('Connections loaded:', data);
        this.connections = data.connections || [];
      },
      error: (err) => {
        console.error('Error fetching connections:', err);
      },
    });
  }

  logout() {
        console.log("Logging out...");
        sessionStorage.clear();
        this._authService.logout().subscribe({
            next: () => {
                console.log("Logout successful");
                this.router.navigate(['/login'], { replaceUrl: true }); // Absolute path with replaceUrl
            },
            error: (err) => {
                console.error("Logout failed:", err);
                this.router.navigate(['/login'], { replaceUrl: true }); // Absolute path with replaceUrl
            }
        });
    }

  openAddModal(): void {
    this.selectedConnection = {
      username: '',
      password: '',
      host: '',
      port: 0,
      dbType: 'mysql2',
      database: '',
      socketPath: '',
    };
    this.isModalOpen = true;
  }

  openEditModal(connection: { id: number; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }): void {
    this.selectedConnection = { ...connection };
    this.isModalOpen = true;
  }

  saveConnection(connection: { id?: number; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }): void {
    if (!connection.username || !connection.host || !connection.port || !connection.dbType) {
      return;
    }

    if (connection.id) {
      // Edit existing connection
      this.connectionService.editConnection(connection.id, connection).subscribe({
        next: () => {
          this.loadConnections();
          this.isModalOpen = false;
        },
        error: (err) => {
          console.error('Error updating connection:', err);
        },
      });
    } else {
      // Add new connection
      this.connectionService.addConnection(connection).subscribe({
        next: () => {
          this.loadConnections();
          this.isModalOpen = false;
        },
        error: (err) => {
          console.error('Error adding connection:', err);
        },
      });
    }
  }

  openDeleteDialog(id: number): void {
    this.connectionToDelete = id;
    this.isConfirmDialogOpen = true;
  }

  confirmDelete(): void {
    if (this.connectionToDelete) {
      const connection = this.connections.find(conn => conn.id === this.connectionToDelete);
      if (connection) {
        this.connectionService.deleteConnection(this.connectionToDelete).subscribe({
          next: () => {
            this.loadConnections();
            this.isConfirmDialogOpen = false;
            this.connectionToDelete = null;
          },
          error: (err) => {
            console.error('Error deleting connection:', err);
          },
        });
      }
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedConnection = null;
  }

  closeConfirmDialog(): void {
    this.isConfirmDialogOpen = false;
    this.connectionToDelete = null;
  }

  onConnectionSelect(connection: { id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }): void {
    console.log('Connecting to server:', connection);
    this.backendService.connect(connection).subscribe({
      next: (response) => {
        console.log('Connection successful:', response.message);
        sessionStorage.setItem('connection', JSON.stringify(connection));
        this.router.navigate(['/connection'], { state: { connection } });
      },
      error: (err) => {
        console.error('Error connecting to database:', err);
        this.router.navigate([''], { replaceUrl: true });
      },
    });
  }
}