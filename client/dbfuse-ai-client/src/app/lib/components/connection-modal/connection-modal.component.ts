import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ConnectionConfig, DatabaseType, ValidationResult } from '@lib/utils/storage/storage.types';
import { ConnectionFormHelper, FormFieldConfig } from '@lib/services/backend/connection-form-helper.service';

@Component({
  selector: 'app-connection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './connection-modal.component.html',
})
export class ConnectionModalComponent implements OnInit, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() connection: ConnectionConfig & { id?: number } = {
    username: '',
    password: '',
    host: 'localhost',
    port: 3306,
    dbType: 'mysql2',
    database: '',
    socketPath: '',
  };

  @Output() onSave = new EventEmitter<ConnectionConfig & { id?: number }>();
  @Output() onCancel = new EventEmitter<void>();

  connectionForm!: FormGroup;
  dbTypes: DatabaseType[] = ['mysql2', 'pg', 'sqlite3', 'mssql', 'oracledb'];
  showPassword = false;
  showAdvanced = false;
  currentFields: FormFieldConfig[] = [];
  validationResult: ValidationResult = { isValid: false, errors: [] };

  constructor(private formHelper: ConnectionFormHelper) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['connection'] && this.connectionForm) {
      this.updateForm();
    }
  }

  private initializeForm(): void {
    this.connectionForm = this.formHelper.createConnectionForm(this.connection);
    this.updateCurrentFields();
    this.validateForm();

    // Subscribe to dbType changes only to update fields
    this.connectionForm.get('dbType')?.valueChanges.subscribe((dbType) => {
      this.updateCurrentFields();
      this.validateForm();
    });

    // Subscribe to form changes for validation only
    this.connectionForm.valueChanges.subscribe(() => {
      this.validateForm();
    });
  }

  private updateForm(): void {
    if (this.connectionForm) {
      this.connectionForm.patchValue(this.connection);
      this.updateCurrentFields();
    }
  }

  private updateCurrentFields(): void {
    const dbType = this.connectionForm.get('dbType')?.value || 'mysql2';
    this.currentFields = this.formHelper.getFormConfig(dbType);
  }

  private validateForm(): void {
    const formValue = this.connectionForm.value;
    const connectionConfig = this.formHelper.formToConnectionConfig(formValue);
    this.validationResult = this.formHelper.validateConnection(connectionConfig);
  }

  getDbTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'mysql2': 'MySQL',
      'pg': 'PostgreSQL',
      'sqlite3': 'SQLite',
      'mssql': 'SQL Server',
      'oracledb': 'Oracle DB'
    };
    return labels[type] || type;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  isFormValid(): boolean {
    return this.connectionForm.valid && this.validationResult.isValid;
  }

  getFieldsByGroup(group: 'basic' | 'security' | 'advanced'): FormFieldConfig[] {
    return this.currentFields.filter(field => field.group === group);
  }

  isFieldVisible(fieldName: string): boolean {
    const dbType = this.connectionForm.get('dbType')?.value;
    const relevantFields = this.formHelper.getRelevantFields(dbType);
    return relevantFields.includes(fieldName);
  }

  getFieldError(fieldName: string): string | null {
    const control = this.connectionForm.get(fieldName);
    if (control && control.invalid && control.touched) {
      if (control.errors?.['required']) {
        return `${fieldName} is required`;
      }
      if (control.errors?.['min']) {
        return `${fieldName} must be greater than ${control.errors['min'].min}`;
      }
      if (control.errors?.['max']) {
        return `${fieldName} must be less than ${control.errors['max'].max}`;
      }
      if (control.errors?.['invalidHostname']) {
        return 'Invalid hostname format';
      }
    }
    return null;
  }

  save(): void {
    if (this.isFormValid()) {
      const formValue = this.connectionForm.value;
      const connectionConfig = this.formHelper.formToConnectionConfig(formValue);
      
      // Include ID if editing
      if (this.connection.id) {
        (connectionConfig as any).id = this.connection.id;
      }

      this.onSave.emit(connectionConfig as ConnectionConfig & { id?: number });
    }
  }

  cancel(): void {
    this.onCancel.emit();
  }

  // Helper methods for template
  getCurrentDbType(): DatabaseType {
    return this.connectionForm.get('dbType')?.value || 'mysql2';
  }

  shouldShowField(fieldName: string, group?: string): boolean {
    if (group === 'advanced' && !this.showAdvanced) {
      return false;
    }
    return this.isFieldVisible(fieldName);
  }

  getSelectOptions(fieldName: string): string[] {
    const field = this.currentFields.find(f => f.name === fieldName);
    return field?.options || [];
  }

  // TrackBy function to optimize ngFor
  trackByFieldName(index: number, field: FormFieldConfig): string {
    return field.name;
  }
}