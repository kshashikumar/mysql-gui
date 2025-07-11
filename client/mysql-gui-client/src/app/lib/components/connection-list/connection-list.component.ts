import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionCardComponent } from '@lib/components/connection-card/connection-card.component';

@Component({
  selector: 'app-connection-list',
  standalone: true,
  imports: [CommonModule, ConnectionCardComponent],
  templateUrl: './connection-list.component.html'
})
export class ConnectionListComponent {
  @Input() connections: { name: string, url: string, status?: string }[] = [];
  @Output() onConnectionSelect = new EventEmitter<{ name: string, url: string }>();
}
