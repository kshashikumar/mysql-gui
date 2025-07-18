import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionCardComponent } from '@lib/components/connection-card/connection-card.component';

@Component({
  selector: 'app-connection-list',
  standalone: true,
  imports: [CommonModule, ConnectionCardComponent],
  templateUrl: './connection-list.component.html',
})
export class ConnectionListComponent {
  @Input() connections: { id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string; status?: string }[] = [];
  @Output() onConnectionSelect = new EventEmitter<{ id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }>();
  @Output() onEdit = new EventEmitter<{ id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }>();
  @Output() onDelete = new EventEmitter<string>();

  onEditConnection(connection: { id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }) {
    this.onEdit.emit(connection);
  }

  onDeleteConnection(id: string) {
    this.onDelete.emit(id);
  }
}