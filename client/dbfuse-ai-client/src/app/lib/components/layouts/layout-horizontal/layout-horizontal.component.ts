import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { HomeComponent } from '@lib/components/home/home.component';
import { NavbarComponent } from '@lib/components/navbar/navbar.component';
import { SideBarComponent } from '@lib/components/sidebar/sidebar.component';
import { BackendService } from '@lib/services';
import { ConnectionConfig, newTabData, openAIEvent } from '@lib/utils/storage/storage.types';
import { ConnectConfig } from 'rxjs';

@Component({
  selector: 'app-layout-horizontal',
  standalone: true,
  imports: [CommonModule, NavbarComponent, SideBarComponent, HomeComponent],
  templateUrl: './layout-horizontal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutHorizontalComponent implements OnInit {
  private readonly _router = inject(Router);
  private readonly _backendService = inject(BackendService);
  private readonly _cdr = inject(ChangeDetectorRef);

  tabData: newTabData | null = null;
  databases: any = {};
  openAIEnabledFlag: openAIEvent | null = null;
  currentServer: string | null = null;
  currentDbName: string | null = null;

  ngOnInit(): void {
    this._router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.handleNavigationEnd();
      }
    });
  }

  private handleNavigationEnd(): void {
    let connection = history.state.connection;
    
    if (!connection) {
      // Fallback to sessionStorage if history.state.connection is not available
      const storedConnection = sessionStorage.getItem('connection');
      if (storedConnection) {
        try {
          connection = JSON.parse(storedConnection);
        } catch (error) {
          console.error('Error parsing stored connection:', error);
          this.navigateToHome();
          return;
        }
      } else {
        console.warn('No connection found in history state or sessionStorage');
        this.navigateToHome();
        return;
      }
    }

    if (connection) {
      this.connectToServer(connection);
    } else {
      console.warn('No connection state found in navigation or sessionStorage');
      this.navigateToHome();
    }
  }

  private navigateToHome(): void {
    this._router.navigate([''], { replaceUrl: true });
  }

  handleNewTabData(event: newTabData): void {
    this.tabData = event;
    this._cdr.markForCheck();
  }

  handleInitData(event: any): void {
    this.databases = event;
    this._cdr.markForCheck();
  }

  handleOpenAIEvent(event: openAIEvent): void {
    this.openAIEnabledFlag = event;
    console.log('OpenAI event received:', event);
    this._cdr.markForCheck();
  }

  private async connectToServer(connection: ConnectionConfig): Promise<void> {
    try {
      await this._backendService.connect(connection).toPromise();
      this.currentServer = `${connection.host}:${connection.port} (${connection.dbType})`;
      this.currentDbName = null;
      console.log(`Connected to ${connection.dbType} server @ ${connection.host}:${connection.port}`);
      this._cdr.markForCheck();
    } catch (err) {
      console.error(`${connection.dbType} server connection failed:`, err);
      this.currentServer = null;
      this.currentDbName = null;
      this._cdr.markForCheck();
      // Optionally redirect to connection page on failure
      // this.navigateToHome();
    }
  }

  async switchDatabase(dbName: string): Promise<void> {
    try {
      await this._backendService.switchDatabase(dbName).toPromise();
      this.currentDbName = dbName;
      console.log(`Switched to database ${dbName}`);
      
      // Fetch databases to update the sidebar
      this._backendService.getDatabases().subscribe({
        next: (data) => {
          this.databases = data;
          this._cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error fetching databases:', err);
        }
      });
    } catch (err) {
      console.error(`Database switch failed:`, err);
      this.currentDbName = null;
      this._cdr.markForCheck();
    }
  }
}