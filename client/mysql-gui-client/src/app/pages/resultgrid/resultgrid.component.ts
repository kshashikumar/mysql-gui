import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, SimpleChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BackendService } from '@lib/services';
import { TruncatePipe } from '@lib/providers/truncate.pipe';

@Component({
    selector: 'app-resultgrid',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, TruncatePipe],
    templateUrl: './resultgrid.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultGridComponent implements OnInit {
    private readonly _dbService = inject(BackendService);
    private readonly _cdr = inject(ChangeDetectorRef);

    @Input() triggerQuery: string = '';
    @Input() executeTriggered: boolean = false;
    @Input() dbName: string = '';
    @Input() tabId: string = '';

    tabsData = new Map<string, any>();
    headers: string[] = [];
    rows: any[] = [];
    isLoading: boolean = false;
    copiedCell: string | null = null;
    errorMessage: string | null = null;
    copiedPosition = { left: 0, top: 0 };
    currentPage: number = 1;
    pageSize: number = 50; // Increased for better UX
    totalRows: number = 0;
    totalPages: number = 1;

    ngOnInit(): void {
        // Initialize component
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['triggerQuery'] || changes['dbName'] || changes['tabId']) {
            if (this.dbName !== '' && this.triggerQuery !== '') {
                this.currentPage = 1;
                this.executeQuery();
            }
        }
    }

    // TrackBy functions for performance
    trackByHeader(index: number, header: string): string {
        return header;
    }

    trackByRow(index: number, row: any): string {
        return `row-${index}-${Object.values(row).join('-')}`;
    }

    executeQuery(): void {
        this.isLoading = true;
        this.errorMessage = null;
        this._cdr.markForCheck();

        const hasLimitOrOffset = /LIMIT\s+\d+/i.test(this.triggerQuery) || /OFFSET\s+\d+/i.test(this.triggerQuery);

        this._dbService.executeQuery(this.triggerQuery, this.dbName, this.currentPage, this.pageSize).subscribe({
            next: (data) => {
                if (data) {
                    const { rows, totalRows } = data;
                    this.tabsData.set(this.tabId, data);
                    this.setData(rows);
                    
                    if (hasLimitOrOffset) {
                        this.currentPage = 1;
                        this.totalPages = 1;
                        this.totalRows = rows.length;
                    } else {
                        this.totalRows = totalRows || 0;
                        this.totalPages = Math.ceil(this.totalRows / this.pageSize) || 1;
                    }
                } else {
                    console.error('Error: API returned empty data or unexpected format');
                    this.setData([]);
                    this.totalRows = 0;
                    this.totalPages = 1;
                }
                this.isLoading = false;
                this._cdr.markForCheck();
            },
            error: (error) => {
                this.errorMessage = error?.error?.error || 'An error occurred while executing the query. Please check your syntax and try again.';
                console.error('Error fetching data:', error);
                this.isLoading = false;
                this.rows = [];
                this.headers = [];
                this.totalRows = 0;
                this.totalPages = 1;
                this._cdr.markForCheck();
            }
        });
    }

    private setData(data: any[]): void {
        if (data && data.length > 0) {
            this.headers = Object.keys(data[0]);
            this.rows = data;
        } else {
            this.headers = [];
            this.rows = [];
        }
        this._cdr.markForCheck();
    }

    copyToClipboard(text: string, rowIndex: number, header: string, event: MouseEvent): void {
        if (text === null || text === undefined) {
            text = 'NULL';
        }

        navigator.clipboard.writeText(String(text)).then(
            () => {
                this.copiedCell = `${rowIndex}-${header}`;
                
                // Position tooltip relative to click
                const rect = (event.target as HTMLElement).getBoundingClientRect();
                this.copiedPosition = { 
                    left: rect.left + rect.width / 2 - 25, // Center tooltip
                    top: rect.top - 35 // Position above element
                };
                
                this._cdr.markForCheck();
                
                // Clear tooltip after 2 seconds
                setTimeout(() => {
                    this.copiedCell = null;
                    this._cdr.markForCheck();
                }, 2000);
                
                console.log('Copied to clipboard:', text);
            },
            (err) => {
                console.error('Failed to copy:', err);
                // Fallback for older browsers
                this.fallbackCopyTextToClipboard(String(text));
            }
        );
    }

    private fallbackCopyTextToClipboard(text: string): void {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            console.log('Fallback: Copied to clipboard');
        } catch (err) {
            console.error('Fallback: Unable to copy', err);
        }
        
        document.body.removeChild(textArea);
    }

    changePage(newPage: number): void {
        if (newPage > 0 && newPage <= this.totalPages && newPage !== this.currentPage) {
            this.currentPage = newPage;
            this.executeQuery();
        }
    }

    goToPage(event: Event): void {
        const target = event.target as HTMLInputElement;
        const pageNumber = parseInt(target.value, 10);
        
        if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= this.totalPages) {
            this.changePage(pageNumber);
        } else {
            // Reset input value if invalid
            target.value = this.currentPage.toString();
        }
    }

    // Utility method to get cell display value
    getCellDisplayValue(value: any): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        if (typeof value === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    // Method to determine cell content type for styling
    getCellType(value: any): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'number') {
            return 'number';
        }
        if (typeof value === 'boolean') {
            return 'boolean';
        }
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
            return 'date';
        }
        return 'string';
    }
}