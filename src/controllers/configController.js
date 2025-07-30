const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Path to .env file
const ENV_PATH = path.join(process.cwd(), '.env');

// Helper function to read .env file
function readEnvFile() {
  try {
    if (!fs.existsSync(ENV_PATH)) {
      // Create default .env file if it doesn't exist
      const defaultConfig = `AI_MODEL=""
AI_API_KEY=""
AI_PROVIDER=""
PORT=5000
DBFUSE_USERNAME=root
DBFUSE_PASSWORD=root`;
      fs.writeFileSync(ENV_PATH, defaultConfig);
    }
    
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const config = {};
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').replace(/^"|"$/g, ''); // Remove quotes
          
          // Convert specific values to appropriate types
          if (key === 'PORT') {
            value = parseInt(value) || 5000;
          }
          
          config[key.trim()] = value;
        }
      }
    });
    
    return config;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return {
      AI_MODEL: '',
      AI_API_KEY: '',
      AI_PROVIDER: '',
      PORT: 5000,
      DBFUSE_USERNAME: 'root',
      DBFUSE_PASSWORD: 'root'
    };
  }
}

// Helper function to write .env file
function writeEnvFile(config) {
  try {
    const envContent = Object.entries(config)
      .map(([key, value]) => {
        // Quote values that contain spaces or special characters
        const needsQuotes = typeof value === 'string' && (value.includes(' ') || value.includes('='));
        return `${key}=${needsQuotes ? `"${value}"` : value}`;
      })
      .join('\n');
    
    fs.writeFileSync(ENV_PATH, envContent);
    return true;
  } catch (error) {
    console.error('Error writing .env file:', error);
    return false;
  }
}

// Helper function to update process.env
function updateProcessEnv(config) {
  Object.entries(config).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

const readConfig = async (req, res) => {
  try {
    const config = readEnvFile();
    res.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
}

const updateConfig = async (req, res) => {
  try {
    const config = req.body;
    const currentPort = parseInt(process.env.PORT) || 5000;
    const newPort = parseInt(config.PORT) || 5000;
    const portChanged = currentPort !== newPort;
    
    // Validate required fields
    if (!config.DBFUSE_USERNAME || !config.DBFUSE_USERNAME.trim()) {
      return res.status(400).json({ error: 'Database username is required' });
    }
    
    if (config.PORT && (config.PORT < 1000 || config.PORT > 65535)) {
      return res.status(400).json({ error: 'Port must be between 1000 and 65535' });
    }
    
    // Write to .env file
    const success = writeEnvFile(config);
    if (!success) {
      return res.status(500).json({ error: 'Failed to save configuration' });
    }
    
    // Update process.env for immediate effect
    updateProcessEnv(config);
    
    // Send response first
    if (portChanged) {
      res.json({ 
        message: 'Configuration saved successfully. Server will restart to apply port changes...', 
        requiresRestart: true,
        newPort: newPort
      });
      
      // Schedule server restart after response is sent
      setTimeout(() => {
        console.log(`Port changed from ${currentPort} to ${newPort}. Restarting server...`);
        process.exit(0); // Exit process - nodemon will restart it
      }, 1000);
    } else {
      res.json({ 
        message: 'Configuration saved successfully',
        requiresRestart: false
      });
    }
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
};

module.exports = {
  readConfig,
  updateConfig
};