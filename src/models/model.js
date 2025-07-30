const { ChatOpenAI } = require("@langchain/openai");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatAnthropic } = require("@langchain/anthropic");
const { ChatMistralAI } = require("@langchain/mistralai");
const { ChatCohere } = require("@langchain/cohere");
const { HuggingFaceInference } = require("@langchain/community/llms/hf");

// AI Model Constants
const AI_MODELS = {
  OPENAI: {
    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "text-davinci-003"],
    provider: "OpenAI"
  },
  GEMINI: {
    models: ["gemini-1.5-flash", "gemini-pro", "gemini-lite"],
    provider: "Gemini"
  },
  ANTHROPIC: {
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-2.1", "claude-instant"],
    provider: "Anthropic"
  },
  MISTRAL: {
    models: ["mistral-large", "mistral-medium", "mistral-small", "mixtral-8x7b"],
    provider: "Mistral"
  },
  COHERE: {
    models: ["command", "command-light", "command-nightly", "command-light-nightly"],
    provider: "Cohere"
  },
  HUGGINGFACE: {
    models: ["microsoft/DialoGPT-medium", "facebook/blenderbot-400M-distill", "microsoft/DialoGPT-large"],
    provider: "HuggingFace"
  },
  PERPLEXITY: {
    models: ["pplx-7b-online", "pplx-70b-online", "llama-2-70b-chat"],
    provider: "Perplexity"
  }
};

const getAIModel = (aiModel, apiKey, provider) => {
  // OpenAI models
  if (AI_MODELS.OPENAI.models.includes(aiModel)) {
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      temperature: 0.7,
      modelName: aiModel,
    });
  }

  // Gemini models
  if (AI_MODELS.GEMINI.models.includes(aiModel)) {
    return new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      temperature: 0.7,
      modelName: aiModel,
    });
  }

  // Anthropic models
  if (AI_MODELS.ANTHROPIC.models.includes(aiModel)) {
    return new ChatAnthropic({
      anthropicApiKey: apiKey,
      temperature: 0.7,
      modelName: aiModel,
    });
  }

  // Mistral models
  if (AI_MODELS.MISTRAL.models.includes(aiModel)) {
    return new ChatMistralAI({
      apiKey: apiKey,
      temperature: 0.7,
      modelName: aiModel,
    });
  }

  // Cohere models
  if (AI_MODELS.COHERE.models.includes(aiModel)) {
    return new ChatCohere({
      apiKey: apiKey,
      temperature: 0.7,
      model: aiModel,
    });
  }

  // HuggingFace models
  if (AI_MODELS.HUGGINGFACE.models.includes(aiModel)) {
    return new HuggingFaceInference({
      apiKey: apiKey,
      model: aiModel,
      temperature: 0.7,
    });
  }

  // Perplexity models
  if (AI_MODELS.PERPLEXITY.models.includes(aiModel)) {
    // Note: Perplexity uses OpenAI-compatible API
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      temperature: 0.7,
      modelName: aiModel,
      configuration: {
        baseURL: "https://api.perplexity.ai",
      },
    });
  }

  throw new Error(`Unsupported AI model: ${aiModel}. Supported providers: ${Object.values(AI_MODELS).map(m => m.provider).join(', ')}`);
};

module.exports = {
  getAIModel,
  AI_MODELS,
};