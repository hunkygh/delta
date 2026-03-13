/**
 * Provider Discovery Utilities
 * Handles cross-provider model discovery and caching
 */

import type { AIProvider } from '../services/aiGateway';

export interface DiscoveredModel {
  id: string;
  name?: string;
  capabilities?: string[];
  provider?: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

export interface ProviderDiscoveryResult {
  provider: string;
  models: DiscoveredModel[];
  lastUpdated: number;
  error?: string;
}

// Cache for model discovery results
const discoveryCache = new Map<string, ProviderDiscoveryResult>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get models from OpenAI-compatible provider
 */
const discoverOpenAIModels = async (provider: AIProvider): Promise<DiscoveredModel[]> => {
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    
    return models.map((model: any) => ({
      id: model.id || '',
      name: model.id || '',
      capabilities: getModelCapabilities(model.id),
      provider: provider.name,
      contextLength: model.max_context_length || undefined,
      pricing: model.pricing || undefined
    }));
  } catch (error) {
    console.warn(`[provider-discovery] Failed to discover models for ${provider.name}:`, error);
    return [];
  }
};

/**
 * Get models from OpenRouter (has different response format)
 */
const discoverOpenRouterModels = async (provider: AIProvider): Promise<DiscoveredModel[]> => {
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    
    return models.map((model: any) => ({
      id: model.id || '',
      name: model.name || model.id || '',
      capabilities: getModelCapabilities(model.id),
      provider: provider.name,
      contextLength: model.context_length || undefined,
      pricing: model.pricing || undefined
    }));
  } catch (error) {
    console.warn(`[provider-discovery] Failed to discover models for ${provider.name}:`, error);
    return [];
  }
};

/**
 * Get models from Together AI
 */
const discoverTogetherModels = async (provider: AIProvider): Promise<DiscoveredModel[]> => {
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const models = Array.isArray(data) ? data : [];
    
    return models.map((model: any) => ({
      id: model.id || '',
      name: model.display_name || model.id || '',
      capabilities: getModelCapabilities(model.id),
      provider: provider.name,
      contextLength: model.context_length || undefined,
      pricing: model.pricing || undefined
    }));
  } catch (error) {
    console.warn(`[provider-discovery] Failed to discover models for ${provider.name}:`, error);
    return [];
  }
};

/**
 * Determine model capabilities based on model ID/name
 */
const getModelCapabilities = (modelId: string): string[] => {
  const id = modelId.toLowerCase();
  const capabilities: string[] = ['chat'];
  
  if (id.includes('claude') || id.includes('gpt-4') || id.includes('llama-3.1-70b')) {
    capabilities.push('reasoning', 'analysis', 'tool-calling');
  }
  
  if (id.includes('turbo') || id.includes('8b') || id.includes('instant')) {
    capabilities.push('fast', 'quick-response');
  }
  
  if (id.includes('instruct') || id.includes('chat')) {
    capabilities.push('instruction-following');
  }
  
  return capabilities;
};

/**
 * Get the appropriate discovery function for a provider
 */
const getDiscoveryFunction = (providerName: string) => {
  switch (providerName.toLowerCase()) {
    case 'openrouter':
      return discoverOpenRouterModels;
    case 'together':
      return discoverTogetherModels;
    case 'openai_compatible':
    case 'openai':
    case 'groq':
      return discoverOpenAIModels;
    default:
      return discoverOpenAIModels; // Default to OpenAI-compatible format
  }
};

/**
 * Discover models for a specific provider with caching
 */
export const discoverProviderModels = async (
  provider: AIProvider,
  forceRefresh = false
): Promise<ProviderDiscoveryResult> => {
  const cacheKey = provider.name;
  const now = Date.now();
  
  // Check cache first
  if (!forceRefresh) {
    const cached = discoveryCache.get(cacheKey);
    if (cached && (now - cached.lastUpdated) < CACHE_TTL_MS) {
      return cached;
    }
  }

  try {
    const discoveryFunction = getDiscoveryFunction(provider.name);
    const models = await discoveryFunction(provider);
    
    const result: ProviderDiscoveryResult = {
      provider: provider.name,
      models,
      lastUpdated: now
    };
    
    // Update cache
    discoveryCache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    const result: ProviderDiscoveryResult = {
      provider: provider.name,
      models: [],
      lastUpdated: now,
      error: error instanceof Error ? error.message : String(error)
    };
    
    // Cache error result for shorter time
    discoveryCache.set(cacheKey, result);
    
    return result;
  }
};

/**
 * Discover models for multiple providers in parallel
 */
export const discoverMultipleProviders = async (
  providers: AIProvider[],
  forceRefresh = false
): Promise<ProviderDiscoveryResult[]> => {
  const promises = providers.map(provider => 
    discoverProviderModels(provider, forceRefresh)
  );
  
  return Promise.all(promises);
};

/**
 * Check if a specific model is available from a provider
 */
export const isModelAvailable = async (
  provider: AIProvider,
  modelId: string,
  forceRefresh = false
): Promise<boolean> => {
  const result = await discoverProviderModels(provider, forceRefresh);
  return result.models.some(model => model.id === modelId);
};

/**
 * Get cached discovery results for all providers
 */
export const getCachedResults = (): Map<string, ProviderDiscoveryResult> => {
  return new Map(discoveryCache);
};

/**
 * Clear discovery cache
 */
export const clearDiscoveryCache = (): void => {
  discoveryCache.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  const now = Date.now();
  const stats = {
    totalProviders: discoveryCache.size,
    freshEntries: 0,
    staleEntries: 0,
    errorEntries: 0
  };
  
  for (const [provider, result] of discoveryCache) {
    const age = now - result.lastUpdated;
    if (result.error) {
      stats.errorEntries++;
    } else if (age < CACHE_TTL_MS) {
      stats.freshEntries++;
    } else {
      stats.staleEntries++;
    }
  }
  
  return stats;
};
