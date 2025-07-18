import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { HomeComponent } from '@lib/components/home/home.component';
import { NavbarComponent } from '@lib/components/navbar/navbar.component';
import { SideBarComponent } from '@lib/components/sidebar/sidebar.component';
import { BackendService } from '@lib/services';
import { newTabData, openAIEvent } from '@lib/utils/storage/storage.types';

@Component({
  selector: 'app-layout-horizontal',
  standalone: true,
  imports: [CommonModule, NavbarComponent, SideBarComponent, HomeComponent],
  templateUrl: './layout-horizontal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutHorizontalComponent implements OnInit {
  tabData: newTabData | null = null;
  databases: any = {};
  openAIEnabledFlag: openAIEvent | null = null;
  currentServer: string | null = null;
  currentDbName: string | null = null;

  constructor(private router: Router, private backendService: BackendService) {
  }

  ngOnInit(): void {
    this.router.events.subscribe((event) => {
    if (event instanceof NavigationEnd) {
      let connection = history.state.connection;
      if (!connection) {
        // Fallback to localStorage if history.state.connection is not available
        const storedConnection = sessionStorage.getItem('connection');
        if (storedConnection) {
          connection = JSON.parse(storedConnection);
        } else {
          console.warn('No connection found in history state or sessionStorage');
          this.router.navigate([''], { replaceUrl: true }); // Use replaceUrl to update the URL
          return;
        }
      }

      if (connection) {
        this.connectToServer(connection);
      } else {
        console.warn('No connection state found in navigation or localStorage');
        this.router.navigate([''], { replaceUrl: true }); // Use replaceUrl to update the URL
      }
    }
  });
  }

  handleNewTabData(event: newTabData) {
    this.tabData = event;
  }

  handleInitData(event: newTabData) {
    this.databases = event;
  }

  handleOpenAIEvent(event: openAIEvent) {
    this.openAIEnabledFlag = event;
  }

  async connectToServer(connection: { id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }) {
    try {
      await this.backendService.connect(connection).toPromise();
      this.currentServer = `${connection.host}:${connection.port} (${connection.dbType})`;
      this.currentDbName = null;
      console.log(`Connected to ${connection.dbType} server @ ${connection.host}:${connection.port}`);
      // Prompt for database name
      // const dbName = sessionStorage.getItem('selectedDB') || prompt('Enter database name to switch to:');
      // if (dbName) {
      //   await this.switchDatabase(dbName);
      // }
    } catch (err) {
      console.error(`${connection.dbType} server connection failed:`, err);
      this.currentServer = null;
      this.currentDbName = null;
    }
  }

  async switchDatabase(dbName: string) {
    try {
      await this.backendService.switchDatabase(dbName).toPromise();
      this.currentDbName = dbName;
      console.log(`Switched to database ${dbName}`);
      // Fetch databases to update the sidebar
      this.backendService.getDatabases().subscribe({
        next: (data) => {
          this.databases = data;
        },
        error: (err) => console.error('Error fetching databases:', err),
      });
    } catch (err) {
      console.error(`Database switch failed:`, err);
      this.currentDbName = null;
    }
  }
}