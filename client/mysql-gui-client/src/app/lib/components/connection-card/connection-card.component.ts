import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-connection-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connection-card.component.html',
  styles: [`
    :host {
      display: block;
      margin: 0.5rem;
    }
  `]
})
export class ConnectionCardComponent {
  @Input() connection!: { name: string, url: string, status?: string };
  @Output() onSelect = new EventEmitter<{ name: string, url: string }>();
}
