import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    HostListener,
    Input,
    Output,
} from '@angular/core';

/**
 * Lightweight reusable modal. Body is projected via <ng-content>. The host owns
 * the open/title/destructive state and listens to (confirm)/(cancel).
 */
@Component({
    selector: 'app-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './modal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
    @Input() open = false;
    @Input() title = '';
    @Input() width: 'sm' | 'md' | 'lg' | 'xl' = 'md';
    @Input() confirmLabel = 'OK';
    @Input() cancelLabel = 'Cancel';
    @Input() destructive = false;
    @Input() disableConfirm = false;
    @Input() hideFooter = false;

    @Output() confirm = new EventEmitter<void>();
    @Output() cancel = new EventEmitter<void>();

    get widthClass(): string {
        switch (this.width) {
            case 'sm':
                return 'max-w-sm';
            case 'lg':
                return 'max-w-2xl';
            case 'xl':
                return 'max-w-4xl';
            default:
                return 'max-w-lg';
        }
    }

    @HostListener('document:keydown.escape')
    onEsc() {
        if (this.open) {
            this.cancel.emit();
        }
    }

    onOverlayClick() {
        this.cancel.emit();
    }

    onCardClick(event: Event) {
        // Prevent overlay-click cancel when clicking inside the card.
        event.stopPropagation();
    }

    onConfirm() {
        if (!this.disableConfirm) {
            this.confirm.emit();
        }
    }
}
