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

// Supported AI models with pricing info
const supportedModels = {
  gemini: {
    models: ["gemini-1.5-flash", "gemini-pro", "gemini-lite"],
    note: "(Free tier available)"
  },
  openai: {
    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "text-davinci-003"],
    note: "(Paid - gpt-3.5-turbo most affordable)"
  },
  anthropic: {
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-2.1", "claude-instant"],
    note: "(Paid - claude-3-haiku most affordable)"
  },
  mistral: {
    models: ["mistral-large", "mistral-medium", "mistral-small", "mixtral-8x7b"],
    note: "(Paid)"
  },
  cohere: {
    models: ["command", "command-light", "command-nightly", "command-light-nightly"],
    note: "(Free tier available)"
  },
  huggingface: {
    models: ["microsoft/DialoGPT-medium", "facebook/blenderbot-400M-distill", "microsoft/DialoGPT-large"],
    note: "(Free)"
  },
  perplexity: {
    models: ["pplx-7b-online", "pplx-70b-online", "llama-2-70b-chat"],
    note: "(Paid)"
  }
};

function askForPort() {
  return new Promise((resolve) => {
    rl.question(
      chalk.yellow(`Please enter the PORT (default is ${defaultPort}): `),
      (portAnswer) => {
        if (portAnswer.trim() === "") {
          resolve(defaultPort);
        } else {
          const portNumber = parseInt(portAnswer, 10);
          resolve(isNaN(portNumber) ? defaultPort : portNumber);
        }
      }
    );
  });
}

function askForDBUsername() {
  return new Promise((resolve) => {
    rl.question(
      chalk.yellow("Please enter the Database Username (default is root): "),
      (username) => {
        resolve(username.trim() === "" ? "root" : username);
      }
    );
  });
}

function askForDBPassword() {
  return new Promise((resolve) => {
    rl.question(
      chalk.yellow("Please enter the Database Password (default is root): "),
      (password) => {
        resolve(password.trim() === "" ? "root" : password);
      }
    );
  });
}

function askForAIUsage() {
  return new Promise((resolve) => {
    rl.question(chalk.green("Do you want to use AI? (yes/no): "), (answer) => {
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

function askForAIModel() {
  return new Promise((resolve) => {
    console.log(chalk.cyan("Choose the AI model you'd like to use:"));
    let counter = 1;
    const modelMap = {};

    Object.entries(supportedModels).forEach(([providerKey, providerData]) => {
      const providerName = providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
      console.log(chalk.cyan(`\n${providerName} Models ${providerData.note}:`));
      
      providerData.models.forEach((model) => {
        console.log(`${counter}. ${chalk.green(model)}`);
        modelMap[counter] = { 
          provider: providerName === 'Huggingface' ? 'HuggingFace' : providerName, 
          model 
        };
        counter++;
      });
    });

    rl.question(chalk.yellow("Enter your choice: "), (choice) => {
      const selectedModel = modelMap[choice];
      if (selectedModel) {
        resolve(selectedModel);
      } else {
        console.log(chalk.red("Invalid choice. Defaulting to Gemini 1.5 Flash."));
        resolve({ provider: "Gemini", model: "gemini-1.5-flash" });
      }
    });
  });
}

function askForAPIKey(provider) {
  return new Promise((resolve) => {
    const providerMap = {
      "OpenAI": "OpenAI",
      "Gemini": "Gemini",
      "HuggingFace": "Hugging Face",
      "Cohere": "Cohere",
      "Anthropic": "Anthropic",
      "Mistral": "Mistral",
      "Perplexity": "Perplexity"
    };
    
    const displayName = providerMap[provider] || provider;
    rl.question(
      chalk.blue(`Please enter your ${displayName} API Key: `),
      (apiKey) => {
        resolve(apiKey);
      }
    );
  });
}

async function main() {
  console.log(
    chalk.magenta(
      "TIP: You can leverage AI for free by obtaining a Gemini API Key (gemini-1.5-flash) online, which allows up to 15 requests per minute at no cost."
    )
  );

  if (majorVersion < MIN_NODE_VERSION) {
    console.error(
      chalk.red(`Node.js version ${MIN_NODE_VERSION} or higher is required.`)
    );
    process.exit(1);
  }
  try {
    const npmVersion = execSync("npm --version").toString().trim();
    const [npmMajorVersion] = npmVersion.split(".").map(Number);
    if (npmMajorVersion < MIN_NPM_VERSION) {
      console.error(
        chalk.red(`npm version ${MIN_NPM_VERSION} or higher is required.`)
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      chalk.red(
        "Failed to check npm version. Ensure npm is installed and accessible."
      )
    );
    process.exit(1);
  }

  if (!argv.p) {
    const port = await askForPort();
    process.env.PORT = port;
  } else {
    process.env.PORT = argv.p;
  }

  if (!argv.dbuser) {
    const dbUsername = await askForDBUsername();
    process.env.DBFUSE_USERNAME = dbUsername;
  } else {
    process.env.DBFUSE_USERNAME = argv.dbuser;
  }

  if (!argv.dbpass) {
    const dbPassword = await askForDBPassword();
    process.env.DBFUSE_PASSWORD = dbPassword;
  } else {
    process.env.DBFUSE_PASSWORD = argv.dbpass;
  }

  if (argv.model && argv.apikey) {
    process.env.AI_MODEL = argv.model;
    process.env.AI_API_KEY = argv.apikey;

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

    if (provider) {
      process.env.AI_PROVIDER = provider;
      console.log(chalk.green(`Using ${provider} model: ${argv.model}`));
    } else {
      console.error(chalk.red("Invalid AI model specified. Exiting..."));
      process.exit(1);
    }
  } else {
    const useAI = await askForAIUsage();

    if (useAI) {
      const selectedModel = await askForAIModel();
      process.env.AI_PROVIDER = selectedModel.provider;
      process.env.AI_MODEL = selectedModel.model;

      const apiKey = await askForAPIKey(selectedModel.provider);
      process.env.AI_API_KEY = apiKey;

      console.log(
        chalk.cyan(
          `\nSelected AI Model: ${selectedModel.model} (${selectedModel.provider})`
        )
      );
      console.log(
        chalk.cyan(`API Key: ${apiKey ? "Provided" : "Not Provided"}`)
      );
    } else {
      console.log(chalk.yellow("AI will not be used in this setup."));
      process.env.AI_PROVIDER = "";
      process.env.AI_MODEL = "";
      process.env.AI_API_KEY = "";
    }
  }

  const scriptPath = path.resolve(__dirname, "src/index.js");
  nodemon({ script: scriptPath });

  rl.close();
}

main().catch((error) => {
  console.error(chalk.red("An error occurred:"), error);
  process.exit(1);
});