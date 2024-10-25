import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { newTabData } from '@lib/utils/storage/storage.types';
import * as CodeMirror from 'codemirror';
import 'codemirror/mode/sql/sql';
import 'codemirror/lib/codemirror.css';

@Component({
    selector: 'app-resultgrid',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './resultgrid.component.html',
})
export class ResultGridComponent {
    constructor() {}
}
