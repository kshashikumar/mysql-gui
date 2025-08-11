#!/usr/bin/env node
const path = require("path");
const nodemon = require("nodemon");
const readline = require("readline");
const { execSync } = require("child_process");
const argv = require("minimist")(process.argv.slice(2));
const chalk = require("chalk");

const MIN_NODE_VERSION = 16;
const MIN_NPM_VERSION = 8;
const [majorVersion] = process.versions.node.split(".").map(Number);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const defaultPort = 5000;

// Modern AI models with updated pricing and availability
const supportedModels = {
  gemini: {
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"],
    note: "🆓 Free tier available",
    description: "Google's latest AI models"
  },
  openai: {
    models: ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-3.5-turbo"],
    note: "💰 Paid (gpt-3.5-turbo most affordable)",
    description: "OpenAI's ChatGPT models"
  },
  anthropic: {
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3.5-sonnet"],
    note: "💰 Paid (claude-3-haiku most affordable)",
    description: "Anthropic's Claude models"
  },
  mistral: {
    models: ["mistral-large", "mistral-medium", "mistral-small", "mixtral-8x7b"],
    note: "💰 Paid",
    description: "Mistral AI's open-source models"
  },
  cohere: {
    models: ["command", "command-light", "command-r", "command-r-plus"],
    note: "🆓 Free tier available",
    description: "Cohere's language models"
  },
  huggingface: {
    models: ["microsoft/DialoGPT-medium", "microsoft/DialoGPT-large", "meta-llama/Llama-2-7b-chat-hf"],
    note: "🆓 Free",
    description: "Open-source models via Hugging Face"
  },
  perplexity: {
    models: ["pplx-7b-online", "pplx-70b-online", "llama-2-70b-chat"],
    note: "💰 Paid",
    description: "Perplexity's search-enhanced models"
  }
};

// Utility functions for better UX
function displayHeader() {
  console.clear();
  console.log(chalk.cyan.bold("╔══════════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan.bold("║                        DBFuse AI Setup                      ║"));
  console.log(chalk.cyan.bold("║            Database GUI with AI-Powered Features            ║"));
  console.log(chalk.cyan.bold("╚══════════════════════════════════════════════════════════════╝"));
  console.log();
}

function displaySection(title) {
  console.log(chalk.yellow.bold(`\n📋 ${title}`));
  console.log(chalk.gray("─".repeat(50)));
}

function displaySuccess(message) {
  console.log(chalk.green.bold(`✅ ${message}`));
}

function displayInfo(message) {
  console.log(chalk.blue(`ℹ️  ${message}`));
}

function displayWarning(message) {
  console.log(chalk.yellow(`⚠️  ${message}`));
}

function askQuestion(question, defaultValue = null) {
  return new Promise((resolve) => {
    const prompt = defaultValue 
      ? `${question} (default: ${chalk.gray(defaultValue)}): `
      : `${question}: `;
    
    rl.question(chalk.white(prompt), (answer) => {
      resolve(answer.trim() === "" && defaultValue ? defaultValue : answer.trim());
    });
  });
}

function askYesNo(question, defaultValue = null) {
  return new Promise((resolve) => {
    const options = defaultValue === true ? "[Y/n]" : defaultValue === false ? "[y/N]" : "[y/n]";
    rl.question(chalk.white(`${question} ${options}: `), (answer) => {
      const response = answer.toLowerCase().trim();
      if (response === "") {
        resolve(defaultValue);
      } else {
        resolve(response === "y" || response === "yes");
      }
    });
  });
}

async function askForPort() {
  displaySection("Server Configuration");
  const port = await askQuestion(`🌐 Server port`, defaultPort);
  const portNumber = parseInt(port, 10);
  return isNaN(portNumber) ? defaultPort : portNumber;
}

async function askForDatabaseCredentials() {
  displaySection("Database Configuration");
  
  const useCustomCreds = await askYesNo(
    "🔐 Do you want to configure custom database credentials?", 
    false
  );
  
  if (!useCustomCreds) {
    displayInfo("Using default credentials (root/root)");
    return { username: "root", password: "root" };
  }
  
  console.log(chalk.cyan("\n🔑 Enter your database credentials:"));
  const username = await askQuestion("   Username", "root");
  const password = await askQuestion("   Password", "root");
  
  return { username, password };
}

async function askForAIUsage() {
  displaySection("AI Configuration");
  
  displayInfo("AI features enhance DBFuse with intelligent query suggestions and database insights.");
  console.log(chalk.magenta("💡 Tip: Gemini offers a generous free tier (15 requests/minute) - perfect for getting started!"));
  
  return await askYesNo("🤖 Enable AI features?", true);
}

async function askForAIModel() {
  console.log(chalk.cyan.bold("\n🧠 Available AI Models:"));
  console.log();
  
  let counter = 1;
  const modelMap = {};
  
  Object.entries(supportedModels).forEach(([providerKey, providerData]) => {
    const providerName = providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
    console.log(chalk.cyan.bold(`${providerData.description}:`));
    console.log(chalk.gray(`   ${providerData.note}`));
    
    providerData.models.forEach((model) => {
      console.log(`   ${chalk.white(counter.toString().padStart(2))}. ${chalk.green(model)}`);
      modelMap[counter] = { 
        provider: providerName === 'Huggingface' ? 'HuggingFace' : providerName, 
        model 
      };
      counter++;
    });
    console.log();
  });
  
  const choice = await askQuestion("Select your preferred AI model (number)");
  const selectedModel = modelMap[choice];
  
  if (selectedModel) {
    return selectedModel;
  } else {
    displayWarning("Invalid selection. Using default: Gemini 1.5 Flash");
    return { provider: "Gemini", model: "gemini-1.5-flash" };
  }
}

async function askForAPIKey(provider) {
  const providerMap = {
    "OpenAI": { name: "OpenAI", url: "https://platform.openai.com/api-keys" },
    "Gemini": { name: "Google Gemini", url: "https://makersuite.google.com/app/apikey" },
    "HuggingFace": { name: "Hugging Face", url: "https://huggingface.co/settings/tokens" },
    "Cohere": { name: "Cohere", url: "https://dashboard.cohere.ai/api-keys" },
    "Anthropic": { name: "Anthropic Claude", url: "https://console.anthropic.com/" },
    "Mistral": { name: "Mistral AI", url: "https://console.mistral.ai/" },
    "Perplexity": { name: "Perplexity", url: "https://www.perplexity.ai/settings/api" }
  };
  
  const providerInfo = providerMap[provider] || { name: provider, url: "" };
  
  console.log(chalk.blue(`\n🔑 ${providerInfo.name} API Key Required`));
  if (providerInfo.url) {
    console.log(chalk.gray(`   Get your key at: ${providerInfo.url}`));
  }
  
  return await askQuestion(`   Enter your ${providerInfo.name} API key`);
}

function validateEnvironment() {
  displaySection("Environment Check");
  
  if (majorVersion < MIN_NODE_VERSION) {
    console.error(chalk.red(`❌ Node.js version ${MIN_NODE_VERSION} or higher is required. Current: ${majorVersion}`));
    process.exit(1);
  }
  displaySuccess(`Node.js ${process.version}`);
  
  try {
    const npmVersion = execSync("npm --version").toString().trim();
    const [npmMajorVersion] = npmVersion.split(".").map(Number);
    if (npmMajorVersion < MIN_NPM_VERSION) {
      console.error(chalk.red(`❌ npm version ${MIN_NPM_VERSION} or higher is required. Current: ${npmVersion}`));
      process.exit(1);
    }
    displaySuccess(`npm ${npmVersion}`);
  } catch (error) {
    console.error(chalk.red("❌ Failed to check npm version. Ensure npm is installed and accessible."));
    process.exit(1);
  }
}

function displayConfiguration(config) {
  displaySection("Configuration Summary");
  console.log(chalk.white(`🌐 Server Port: ${chalk.green(config.port)}`));
  console.log(chalk.white(`🔐 Database User: ${chalk.green(config.dbUsername)}`));
  console.log(chalk.white(`🔑 Database Pass: ${chalk.green('*'.repeat(config.dbPassword.length))}`));
  
  if (config.aiEnabled) {
    console.log(chalk.white(`🤖 AI Provider: ${chalk.green(config.aiProvider)}`));
    console.log(chalk.white(`🧠 AI Model: ${chalk.green(config.aiModel)}`));
    console.log(chalk.white(`🔑 API Key: ${chalk.green(config.apiKey ? '✅ Configured' : '❌ Not provided')}`));
  } else {
    console.log(chalk.white(`🤖 AI Features: ${chalk.yellow('Disabled')}`));
  }
}

async function main() {
  try {
    displayHeader();
    validateEnvironment();
    
    // Handle command line arguments
    const config = {
      port: argv.p || await askForPort(),
      aiEnabled: false,
      aiProvider: "",
      aiModel: "",
      apiKey: ""
    };
    
    // Database credentials
    if (argv.dbuser && argv.dbpass) {
      config.dbUsername = argv.dbuser;
      config.dbPassword = argv.dbpass;
    } else {
      const dbCreds = await askForDatabaseCredentials();
      config.dbUsername = dbCreds.username;
      config.dbPassword = dbCreds.password;
    }
    
    // AI Configuration
    if (argv.model && argv.apikey) {
      config.aiEnabled = true;
      config.aiModel = argv.model;
      config.apiKey = argv.apikey;
      
      // Determine provider based on model
      let provider = null;
      for (const [providerKey, providerData] of Object.entries(supportedModels)) {
        if (providerData.models.includes(argv.model)) {
          provider = providerKey === 'gemini' ? 'Gemini' : 
                    providerKey === 'openai' ? 'OpenAI' :
                    providerKey === 'anthropic' ? 'Anthropic' :
                    providerKey === 'mistral' ? 'Mistral' :
                    providerKey === 'cohere' ? 'Cohere' :
                    providerKey === 'huggingface' ? 'HuggingFace' :
                    providerKey === 'perplexity' ? 'Perplexity' : null;
          break;
        }
      }
      
      if (!provider) {
        console.error(chalk.red("❌ Invalid AI model specified. Exiting..."));
        process.exit(1);
      }
      config.aiProvider = provider;
      
    } else {
      config.aiEnabled = await askForAIUsage();
      
      if (config.aiEnabled) {
        const selectedModel = await askForAIModel();
        config.aiProvider = selectedModel.provider;
        config.aiModel = selectedModel.model;
        config.apiKey = await askForAPIKey(selectedModel.provider);
      }
    }
    
    // Set environment variables
    process.env.PORT = config.port;
    process.env.DBFUSE_USERNAME = config.dbUsername;
    process.env.DBFUSE_PASSWORD = config.dbPassword;
    process.env.AI_PROVIDER = config.aiProvider;
    process.env.AI_MODEL = config.aiModel;
    process.env.AI_API_KEY = config.apiKey;
    
    // Display final configuration
    displayConfiguration(config);
    
    displaySection("Starting DBFuse AI");
    displayInfo("Press Ctrl+C to stop the server");
    console.log();
    
    const scriptPath = path.resolve(__dirname, "src/index.js");
    nodemon({ 
      script: scriptPath,
      stdout: false
    });
    
    nodemon.on('start', () => {
      console.log(chalk.green.bold(`🚀 DBFuse AI is running on http://localhost:${config.port}`));
    });
    
    nodemon.on('restart', (files) => {
      console.log(chalk.blue('🔄 App restarted due to:', files));
    });
    
  } catch (error) {
    console.error(chalk.red("❌ Setup failed:"), error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down DBFuse AI...'));
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n👋 Shutting down DBFuse AI...'));
  rl.close();
  process.exit(0);
});

main().catch((error) => {
  console.error(chalk.red("❌ An unexpected error occurred:"), error);
  rl.close();
  process.exit(1);
});