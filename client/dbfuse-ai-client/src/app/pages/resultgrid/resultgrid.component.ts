import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, Output, EventEmitter, SimpleChanges, OnInit, inject } from '@angular/core';
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
    @Output() resultsChanged = new EventEmitter<any[]>();

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

    queryResults: any[] = [];      // data.queries[]
  activeQueryIndex: number = 0;

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
        if (changes['executeTriggered']) {
        const prev = changes['executeTriggered'].previousValue;
        const curr = changes['executeTriggered'].currentValue;
        if (prev !== curr && this.dbName !== '' && this.triggerQuery !== '') {
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

    this._dbService
      .executeQuery(this.triggerQuery, this.dbName, { page: this.currentPage, pageSize: this.pageSize })
      .subscribe({
        next: (data) => {
          if (data) {
            if (Array.isArray(data.queries)) {
              // Multi-query
              this.queryResults = data.queries;
              // Keep index in range (e.g., after re-exec)
              this.activeQueryIndex = Math.min(this.activeQueryIndex, this.queryResults.length - 1);
              if (this.activeQueryIndex < 0) this.activeQueryIndex = 0;

              // Let parent render tabs
              this.resultsChanged.emit(
                (data.queries || []).map((q: any, idx: number) => {
                    // Try to infer table name from query or fallback to index
                    let tableName = '';
                    const match = q.query?.match(/FROM\s+([^\s;]+)/i);
                    if (match && match[1]) {
                    tableName = match[1].replace(/[`"'[\]]/g, ''); // strip quotes/brackets
                    }
                    const displayName = this.dbName && tableName
                    ? `${this.dbName}.${tableName}`
                    : `${this.dbName || 'Query'}_${idx + 1}`;
                    
                    return { ...q, displayName };
                })
                );

              // Apply selected result to grid
              this.applyActiveQueryData();

              this.tabsData.set(this.tabId, data);
            } else {
              // Single-query fallback
              const single = data as any;
              const rows = Array.isArray(single.rows) ? single.rows : [];
              const totalRows = typeof single.totalRows === 'number' ? single.totalRows : rows.length;

              this.queryResults = [];
              this.activeQueryIndex = 0;
              this.resultsChanged.emit([]); // parent hides tabs

              this.setData(rows);
              this.totalRows = totalRows || 0;
              this.totalPages = Math.ceil(this.totalRows / this.pageSize) || 1;
              this.tabsData.set(this.tabId, data);
            }
          } else {
            this.setData([]);
            this.queryResults = [];
            this.resultsChanged.emit([]);
            this.totalRows = 0;
            this.totalPages = 1;
          }
          this.isLoading = false;
          this._cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.error ||
            'An error occurred while executing the query. Please check your syntax and try again.';
          this.isLoading = false;
          this.rows = [];
          this.headers = [];
          this.queryResults = [];
          this.resultsChanged.emit([]);
          this.totalRows = 0;
          this.totalPages = 1;
          this._cdr.markForCheck();
        },
      });
  }

  // PUBLIC: switch active result from parent
  public setActiveResultIndex(index: number): void {
    if (index < 0 || index >= this.queryResults.length) return;
    this.activeQueryIndex = index;
    this.applyActiveQueryData();
  }

  // PUBLIC: close a result tab from parent
  public closeResultTab(index: number): void {
    if (index < 0 || index >= this.queryResults.length) return;

    this.queryResults.splice(index, 1);

    // Adjust active index
    if (this.activeQueryIndex >= this.queryResults.length) {
      this.activeQueryIndex = this.queryResults.length - 1;
    }
    if (this.activeQueryIndex < 0) {
      this.activeQueryIndex = 0;
    }

    // Emit to parent and re-apply view
    this.resultsChanged.emit(this.queryResults);
    if (this.queryResults.length > 0) {
      this.applyActiveQueryData();
    } else {
      // No results left: clear grid
      this.setData([]);
      this.totalRows = 0;
      this.totalPages = 1;
      this._cdr.markForCheck();
    }
  }

  // Apply current result into grid & pagination
  private applyActiveQueryData(): void {
    const active = this.queryResults[this.activeQueryIndex];
    const rows = active?.rows || [];
    this.setData(rows);

    // Use per-statement pagination when present; else compute from totalRows
    if (active?.pagination) {
      this.currentPage = active.pagination.page || 1;
      this.pageSize = active.pagination.pageSize || this.pageSize;
      this.totalPages = active.pagination.totalPages || 1;
      this.totalRows = typeof active.totalRows === 'number' ? active.totalRows : rows.length;
    } else {
      this.totalRows = typeof active?.totalRows === 'number' ? active.totalRows : rows.length;
      this.totalPages = Math.ceil(this.totalRows / this.pageSize) || 1;
    }
  }


  // NEW: switch between result tabs
  selectResultTab(index: number): void {
    if (index < 0 || index >= this.queryResults.length) return;
    this.activeQueryIndex = index;
    this.applyActiveQueryData();
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
      this.executeQuery(); // backend paginates current SELECT; we keep active index
    }
  }

    goToPage(event: Event): void {
    const target = event.target as HTMLInputElement;
    const pageNumber = parseInt(target.value, 10);

    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= this.totalPages) {
      this.changePage(pageNumber);
    } else {
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