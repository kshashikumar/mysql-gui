import { Directive, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Directive({
  selector: '[appDragDropTab]',
  standalone: true,
})
export class DragDropTabDirective {
  @Input() tabIndex: number | undefined;
  @Output() dragStart = new EventEmitter<number>();
  @Output() dragOver = new EventEmitter<Event>();
  @Output() drop = new EventEmitter<number>();
  @Output() dragEnd = new EventEmitter<void>();

  constructor(private el: ElementRef) {
    this.el.nativeElement.setAttribute('draggable', 'true');
  }

  @HostListener('dragstart', ['$event'])
  onDragStart(event: DragEvent) {
    if (this.tabIndex !== undefined) {
      event.dataTransfer?.setData('text/plain', this.tabIndex.toString());
      this.el.nativeElement.classList.add('opacity-50');
      this.dragStart.emit(this.tabIndex);
    }
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dragOver.emit(event);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    if (this.tabIndex !== undefined) {
      this.drop.emit(this.tabIndex);
    }
  }

  @HostListener('dragend', ['$event'])
  onDragEnd() {
    this.el.nativeElement.classList.remove('opacity-50');
    this.dragEnd.emit();
  }
}