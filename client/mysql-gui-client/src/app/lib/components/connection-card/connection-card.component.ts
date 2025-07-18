import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-connection-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connection-card.component.html',
  styles: [
    `
      :host {
        display: block;
        margin: 0.5rem;
      }
    `,
  ],
})
export class ConnectionCardComponent {
  @Input() connection!: { id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string; status?: string };
  @Output() onSelect = new EventEmitter<{ id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }>();
  @Output() onEdit = new EventEmitter<{ id: string; username: string; password: string; host: string; port: number; dbType: string; database?: string; socketPath?: string }>();
  @Output() onDelete = new EventEmitter<string>();

  constructor(private router: Router) {}

  onSelectConnection() {
    this.onSelect.emit(this.connection);
    this.router.navigate(['/connection'], { state: { connection: this.connection } });
  }

  onEditConnection() {
    this.onEdit.emit(this.connection);
  }

  onDeleteConnection() {
    this.onDelete.emit(this.connection.id);
  }
}