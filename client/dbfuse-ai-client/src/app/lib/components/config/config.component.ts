// config.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { ConfigData, ModelOption, SaveResponse } from '@lib/utils/storage/storage.types';
import { BackendService } from '@lib/services';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config.component.html'
})
export class ConfigComponent implements OnInit {
  config: ConfigData = {
    AI_MODEL: '',
    AI_API_KEY: '',
    AI_PROVIDER: '',
    PORT: 5000,
    DBFUSE_USERNAME: '',
    DBFUSE_PASSWORD: ''
  };

  originalConfig: ConfigData = { ...this.config };
  isLoading = false;
  isSaving = false;
  isRestarting = false;
  message = '';
  messageType = '';
  showPassword = false;
  showApiKey = false;

  supportedModels: ModelOption[] = [
    {
      provider: 'Gemini',
      models: ['gemini-1.5-flash', 'gemini-pro', 'gemini-lite']
    },
    {
      provider: 'OpenAI',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'text-davinci-003']
    },
    {
      provider: 'Anthropic',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1', 'claude-instant']
    },
    {
      provider: 'Mistral',
      models: ['mistral-large', 'mistral-medium', 'mistral-small', 'mixtral-8x7b']
    },
    {
      provider: 'Cohere',
      models: ['command', 'command-light', 'command-nightly', 'command-light-nightly']
    },
    {
      provider: 'HuggingFace',
      models: ['microsoft/DialoGPT-medium', 'facebook/blenderbot-400M-distill', 'microsoft/DialoGPT-large']
    },
    {
      provider: 'Perplexity',
      models: ['pplx-7b-online', 'pplx-70b-online', 'llama-2-70b-chat']
    }
  ];

  constructor(
    private backendService: BackendService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit() {
    this.loadConfig();
  }

  loadConfig() {
    this.isLoading = true;
    this.backendService.getConfigData().subscribe({
      next: (data) => {
        this.config = { ...data };
        this.originalConfig = { ...data };
        this.isLoading = false;
        console.log('Config loaded:', this.config);
      },
      error: (error) => {
        console.error('Error loading config:', error);
        this.showMessage('Failed to load configuration', 'error');
        this.isLoading = false;
      }
    });
  }

  saveConfig() {
    if (!this.validateConfig()) {
      return;
    }

    const portChanged = this.config.PORT !== this.originalConfig.PORT;

    this.isSaving = true;
    this.backendService.updateConfigData(this.config).subscribe({
      next: (response) => {
        this.originalConfig = { ...this.config };
        this.showMessage(response.message, 'success');
        this.isSaving = false;

        if (response.requiresRestart && response.newPort) {
          this.handleServerRestart(response.newPort);
        }
      },
      error: (error) => {
        console.error('Error saving config:', error);
        this.showMessage('Error saving configuration', 'error');
        this.isSaving = false;
      }
    });
  }

  handleServerRestart(newPort: number) {
    this.isRestarting = true;
    this.showMessage('Server is restarting with new port...', 'info');

    setTimeout(() => {
      const currentHost = window.location.hostname;
      const newUrl = `http://${currentHost}:${newPort}${window.location.pathname}`;
      
      let countdown = 5;
      const countdownInterval = setInterval(() => {
        this.showMessage(`Redirecting to new port in ${countdown} seconds...`, 'info');
        countdown--;
        
        if (countdown < 0) {
          clearInterval(countdownInterval);
          window.location.href = newUrl;
        }
      }, 1000);
    }, 2000);
  }

  resetConfig() {
    this.config = { ...this.originalConfig };
    this.showMessage('Configuration reset to last saved values', 'info');
  }

  onProviderChange() {
    this.config.AI_MODEL = '';
  }

  getModelsForProvider(): string[] {
    const provider = this.supportedModels.find(p => p.provider === this.config.AI_PROVIDER);
    return provider ? provider.models : [];
  }

  validateConfig(): boolean {
    if (this.config.PORT < 1000 || this.config.PORT > 65535) {
      this.showMessage('Port must be between 1000 and 65535', 'error');
      return false;
    }

    if (!this.config.DBFUSE_USERNAME.trim()) {
      this.showMessage('Database username is required', 'error');
      return false;
    }

    return true;
  }

  hasChanges(): boolean {
    return JSON.stringify(this.config) !== JSON.stringify(this.originalConfig);
  }

  showMessage(text: string, type: string) {
    this.message = text;
    this.messageType = type;
    
    setTimeout(() => {
      this.message = '';
      this.messageType = '';
    }, 3000);
  }

  goBack() {
    this.location.back();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleApiKeyVisibility() {
    this.showApiKey = !this.showApiKey;
  }
}