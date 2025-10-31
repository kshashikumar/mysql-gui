import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, SimpleChanges } from '@angular/core';
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
export class ResultGridComponent {
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
    pageSize: number = 10;
    totalRows: number = 0;
    totalPages: number = 1;

    constructor(private dbService: BackendService, private cdr: ChangeDetectorRef) {}

    ngOnChanges(changes: SimpleChanges) {
        if (changes['triggerQuery'] || changes['dbName'] || changes['tabId']) {
            if (this.dbName != '' && this.triggerQuery != '') {
                this.currentPage = 1;
                this.executeQuery();
            }
        }
    }

    executeQuery() {
        // if (!this.executeTriggered && this.tabsData.has(this.tabId)) {
        //     console.log('Using cached data for tab:', this.tabId);
        //     this.isLoading = true;
        //     const cachedData = this.tabsData.get(this.tabId)[0];
        //     if (cachedData) {
        //         const { rows, totalRows } = cachedData;
        //         this.setData(rows);
        //         this.totalRows = totalRows;
        //         this.totalPages = Math.ceil(this.totalRows / this.pageSize);
        //     }
        //     this.isLoading = false;
        //     this.cdr.markForCheck();
        //     return;
        // }

        this.isLoading = true;
        this.errorMessage = null;
        this.cdr.markForCheck();

        const hasLimitOrOffset = /LIMIT\s+\d+/i.test(this.triggerQuery) || /OFFSET\s+\d+/i.test(this.triggerQuery);
        let effectiveQuery = this.triggerQuery;

        if (!hasLimitOrOffset) {
            const offset = (this.currentPage - 1) * this.pageSize;
            effectiveQuery = `${this.triggerQuery} LIMIT ${this.pageSize} OFFSET ${offset}`;
        }

        this.dbService.executeQuery(this.triggerQuery, this.dbName, this.currentPage, this.pageSize).subscribe(
            (data) => {
                if (data) {
                    const { rows, totalRows } = data;
                    this.tabsData.set(this.tabId, data);
                    this.setData(rows);
                    if (hasLimitOrOffset) {
                        this.currentPage = 1;
                        this.totalPages = 1;
                        this.totalRows = rows.length;
                    } else {
                        this.totalRows = totalRows;
                        this.totalPages = Math.ceil(this.totalRows / this.pageSize);
                    }
                } else {
                    console.error('Error: API returned empty data or unexpected format');
                    this.setData([]); // Clear data if API response is empty
                    this.totalRows = 0;
                    this.totalPages = 1;
                }
                this.isLoading = false;
                this.cdr.markForCheck();
            },
            (error) => {
                this.errorMessage = 'An error occurred while executing the query. Please check and try again.';
                console.error('Error fetching data', error);
                this.isLoading = false;
                this.rows = [];
                this.headers = [];
                this.cdr.markForCheck();
            },
        );
    }

    private setData(data: any[]) {
        if (data && data.length > 0) {
            this.headers = Object.keys(data[0]);
            this.rows = data;
        } else {
            this.headers = [];
            this.rows = [];
        }
        this.cdr.markForCheck();
    }

    copyToClipboard(text: string, rowIndex: number, header: string, event: MouseEvent) {
    navigator.clipboard.writeText(text).then(
        () => {
            this.copiedCell = `${rowIndex}-${header}`;
            this.copiedPosition = { left: event.pageX, top: event.pageY - 30 };
            this.cdr.markForCheck();

            // ✅ Show a small toast message (visible above title)
            const msg = document.createElement('div');
            msg.innerText = 'Copied to clipboard!';
            msg.style.position = 'fixed';
            msg.style.top = '60px'; // ensures it's below the title bar
            msg.style.right = '20px';
            msg.style.background = '#333';
            msg.style.color = '#fff';
            msg.style.padding = '8px 12px';
            msg.style.borderRadius = '6px';
            msg.style.zIndex = '9999';
            msg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            msg.style.fontSize = '14px';
            msg.style.opacity = '1';
            msg.style.transition = 'opacity 0.5s';
            document.body.appendChild(msg);

            // Fade out after 2 seconds
            setTimeout(() => {
                msg.style.opacity = '0';
                setTimeout(() => msg.remove(), 500);
            }, 2000);

            // Keep your original copied state logic
            setTimeout(() => {
                this.copiedCell = null;
                this.cdr.markForCheck();
            }, 1000);

            console.log('Copied to clipboard:', text);
        },
        (err) => {
            console.error('Failed to copy:', err);
        },
    );
}


    changePage(newPage: number) {
        if (newPage > 0 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.executeQuery();
        }
    }
}
