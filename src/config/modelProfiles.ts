/**
 * Model Profile Configuration
 * Maps internal model profiles to provider-specific models
 */

export interface ModelProfile {
  id: string;
  provider: string;
  capabilities: string[];
  costTier: 'cheap' | 'general' | 'reasoning' | 'fast';
  providerModelId?: string;
  description?: string;
}

/**
 * Internal model profiles used throughout the app
 * These abstract away provider-specific model names
 */
export const MODEL_PROFILES: Record<string, ModelProfile[]> = {
  'delta-general': [
    {
      id: 'delta-general',
      provider: 'openrouter',
      capabilities: ['chat', 'reasoning', 'tool-calling'],
      costTier: 'general',
      providerModelId: 'anthropic/claude-3.5-sonnet',
      description: 'Balanced performance for general tasks'
    },
    {
      id: 'delta-general',
      provider: 'together',
      capabilities: ['chat', 'reasoning'],
      costTier: 'general',
      providerModelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      description: 'General purpose reasoning'
    },
    {
      id: 'delta-general',
      provider: 'openai_compatible',
      capabilities: ['chat', 'reasoning', 'tool-calling'],
      costTier: 'general',
      providerModelId: 'gpt-4o',
      description: 'General purpose AI model'
    }
  ],
  
  'delta-cheap': [
    {
      id: 'delta-cheap',
      provider: 'openrouter',
      capabilities: ['chat'],
      costTier: 'cheap',
      providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      description: 'Cost-effective chat model'
    },
    {
      id: 'delta-cheap',
      provider: 'together',
      capabilities: ['chat'],
      costTier: 'cheap',
      providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      description: 'Affordable fast inference'
    },
    {
      id: 'delta-cheap',
      provider: 'openai_compatible',
      capabilities: ['chat'],
      costTier: 'cheap',
      providerModelId: 'gpt-3.5-turbo',
      description: 'Budget-friendly model'
    }
  ],
  
  'delta-reasoning': [
    {
      id: 'delta-reasoning',
      provider: 'openrouter',
      capabilities: ['chat', 'reasoning', 'analysis'],
      costTier: 'reasoning',
      providerModelId: 'openai/gpt-4o',
      description: 'Advanced reasoning capabilities'
    },
    {
      id: 'delta-reasoning',
      provider: 'together',
      capabilities: ['chat', 'reasoning', 'analysis'],
      costTier: 'reasoning',
      providerModelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      description: 'Strong reasoning performance'
    },
    {
      id: 'delta-reasoning',
      provider: 'openai_compatible',
      capabilities: ['chat', 'reasoning', 'analysis'],
      costTier: 'reasoning',
      providerModelId: 'gpt-4o',
      description: 'Advanced analytical reasoning'
    }
  ],
  
  'delta-fast': [
    {
      id: 'delta-fast',
      provider: 'openrouter',
      capabilities: ['chat', 'quick-response'],
      costTier: 'fast',
      providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      description: 'Fast response times'
    },
    {
      id: 'delta-fast',
      provider: 'together',
      capabilities: ['chat', 'quick-response'],
      costTier: 'fast',
      providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      description: 'Optimized for speed'
    },
    {
      id: 'delta-fast',
      provider: 'openai_compatible',
      capabilities: ['chat', 'quick-response'],
      costTier: 'fast',
      providerModelId: 'gpt-3.5-turbo',
      description: 'Rapid responses'
    }
  ],
  
  'delta-classifier': [
    {
      id: 'delta-classifier',
      provider: 'openrouter',
      capabilities: ['chat', 'classification'],
      costTier: 'cheap',
      providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      description: 'Lightweight classification model'
    },
    {
      id: 'delta-classifier',
      provider: 'together',
      capabilities: ['chat', 'classification'],
      costTier: 'cheap',
      providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      description: 'Efficient classification'
    },
    {
      id: 'delta-classifier',
      provider: 'openai_compatible',
      capabilities: ['chat', 'classification'],
      costTier: 'cheap',
      providerModelId: 'gpt-3.5-turbo',
      description: 'Quick classification tasks'
    }
  ]
};

/**
 * Default model profile to use when none specified
 */
export const DEFAULT_MODEL_PROFILE = 'delta-general';

/**
 * Model profile for intent classification
 */
export const CLASSIFIER_MODEL_PROFILE = 'delta-classifier';

/**
 * Get all available model profile IDs
 */
export const getModelProfileIds = (): string[] => {
  return Object.keys(MODEL_PROFILES);
};

/**
 * Get model profiles for a specific profile ID
 */
export const getModelProfiles = (profileId: string): ModelProfile[] => {
  return MODEL_PROFILES[profileId] || [];
};

/**
 * Get primary model profile for a provider
 */
export const getPrimaryProfileForProvider = (providerName: string, profileId: string): ModelProfile | null => {
  const profiles = getModelProfiles(profileId);
  return profiles.find(p => p.provider === providerName) || null;
};

/**
 * Check if a model profile exists
 */
export const hasModelProfile = (profileId: string): boolean => {
  return profileId in MODEL_PROFILES;
};
