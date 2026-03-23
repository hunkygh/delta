/**
 * Provider-agnostic AI Gateway
 * Handles multiple AI providers with fallback logic and model profile management
 */

export interface AIProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: ModelProfile[];
}

export interface ModelProfile {
  id: string;
  provider: string;
  capabilities: string[];
  costTier: 'cheap' | 'general' | 'reasoning' | 'fast';
  providerModelId?: string;
}

export interface AICompletionRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  modelProfile?: string;
}

export interface AICompletionResponse {
  content: string;
  modelUsed: string;
  providerUsed: string;
  fallbackOccurred: boolean;
  requestId: string;
}

export interface AIModelDiscovery {
  provider: string;
  models: Array<{
    id: string;
    name?: string;
    capabilities?: string[];
  }>;
  lastUpdated: number;
}

// Environment-based provider configuration
const getProviderConfig = (): {
  primary: AIProvider | null;
  secondary: AIProvider | null;
  fallback: AIProvider | null;
} => {
  const viteEnv = (import.meta as any).env || {};
  
  const primary = viteEnv.VITE_AI_PROVIDER_PRIMARY && viteEnv.VITE_AI_API_KEY_PRIMARY
    ? {
        name: normalizeProviderName(viteEnv.VITE_AI_PROVIDER_PRIMARY),
        baseUrl: viteEnv.VITE_AI_BASE_URL_PRIMARY || getDefaultBaseUrl(normalizeProviderName(viteEnv.VITE_AI_PROVIDER_PRIMARY)),
        apiKey: viteEnv.VITE_AI_API_KEY_PRIMARY,
        models: []
      }
    : null;

  const secondary = viteEnv.VITE_AI_PROVIDER_SECONDARY && viteEnv.VITE_AI_API_KEY_SECONDARY
    ? {
        name: normalizeProviderName(viteEnv.VITE_AI_PROVIDER_SECONDARY),
        baseUrl:
          viteEnv.VITE_AI_BASE_URL_SECONDARY || getDefaultBaseUrl(normalizeProviderName(viteEnv.VITE_AI_PROVIDER_SECONDARY)),
        apiKey: viteEnv.VITE_AI_API_KEY_SECONDARY,
        models: []
      }
    : null;

  const fallback = viteEnv.VITE_AI_PROVIDER_FALLBACK && viteEnv.VITE_AI_API_KEY_FALLBACK
    ? {
        name: normalizeProviderName(viteEnv.VITE_AI_PROVIDER_FALLBACK),
        baseUrl:
          viteEnv.VITE_AI_BASE_URL_FALLBACK || getDefaultBaseUrl(normalizeProviderName(viteEnv.VITE_AI_PROVIDER_FALLBACK)),
        apiKey: viteEnv.VITE_AI_API_KEY_FALLBACK,
        models: []
      }
    : null;

  return { primary, secondary, fallback };
};

const getDefaultBaseUrl = (provider: string): string => {
  const defaults: Record<string, string> = {
    'google': 'https://generativelanguage.googleapis.com/v1beta',
    'openrouter': 'https://openrouter.ai/api/v1',
    'together': 'https://api.together.xyz/v1',
    'openai_compatible': 'https://api.openai.com/v1',
    'groq': 'https://api.groq.com/openai/v1',
    'deepseek': 'https://api.deepseek.com'
  };
  return defaults[provider] || 'https://api.openai.com/v1';
};

const PROVIDER_MODEL_FALLBACKS: Record<string, Record<string, string[]>> = {
  groq: {
    'delta-general': ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'],
    'delta-cheap': ['llama-3.1-8b-instant', 'qwen/qwen3-32b', 'openai/gpt-oss-20b'],
    'delta-reasoning': ['openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile'],
    'delta-fast': ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'],
    'delta-classifier': ['llama-3.1-8b-instant', 'qwen/qwen3-32b', 'openai/gpt-oss-20b']
  }
};

// Model profile to provider/model mappings
const getModelProfileMappings = (): Record<string, ModelProfile[]> => {
  return {
    'delta-general': [
      { id: 'delta-general', provider: 'google', capabilities: ['chat', 'reasoning'], costTier: 'general', providerModelId: 'gemini-2.5-flash-lite' },
      { id: 'delta-general', provider: 'openrouter', capabilities: ['chat', 'reasoning'], costTier: 'general', providerModelId: 'anthropic/claude-3.5-sonnet' },
      { id: 'delta-general', provider: 'together', capabilities: ['chat', 'reasoning'], costTier: 'general', providerModelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
      { id: 'delta-general', provider: 'groq', capabilities: ['chat', 'reasoning'], costTier: 'general', providerModelId: 'llama-3.3-70b-versatile' },
      { id: 'delta-general', provider: 'deepseek', capabilities: ['chat', 'reasoning'], costTier: 'general', providerModelId: 'deepseek-chat' },
      { id: 'delta-general', provider: 'openai_compatible', capabilities: ['chat', 'reasoning'], costTier: 'general', providerModelId: 'gpt-4o' }
    ],
    'delta-cheap': [
      { id: 'delta-cheap', provider: 'google', capabilities: ['chat'], costTier: 'cheap', providerModelId: 'gemini-2.5-flash-lite' },
      { id: 'delta-cheap', provider: 'openrouter', capabilities: ['chat'], costTier: 'cheap', providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
      { id: 'delta-cheap', provider: 'together', capabilities: ['chat'], costTier: 'cheap', providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
      { id: 'delta-cheap', provider: 'groq', capabilities: ['chat'], costTier: 'cheap', providerModelId: 'llama-3.1-8b-instant' },
      { id: 'delta-cheap', provider: 'deepseek', capabilities: ['chat'], costTier: 'cheap', providerModelId: 'deepseek-chat' },
      { id: 'delta-cheap', provider: 'openai_compatible', capabilities: ['chat'], costTier: 'cheap', providerModelId: 'gpt-4o-mini' }
    ],
    'delta-reasoning': [
      { id: 'delta-reasoning', provider: 'google', capabilities: ['chat', 'reasoning'], costTier: 'reasoning', providerModelId: 'gemini-2.5-flash-lite' },
      { id: 'delta-reasoning', provider: 'openrouter', capabilities: ['chat', 'reasoning'], costTier: 'reasoning', providerModelId: 'openai/gpt-4o' },
      { id: 'delta-reasoning', provider: 'together', capabilities: ['chat', 'reasoning'], costTier: 'reasoning', providerModelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
      { id: 'delta-reasoning', provider: 'groq', capabilities: ['chat', 'reasoning'], costTier: 'reasoning', providerModelId: 'openai/gpt-oss-120b' },
      { id: 'delta-reasoning', provider: 'deepseek', capabilities: ['chat', 'reasoning'], costTier: 'reasoning', providerModelId: 'deepseek-reasoner' },
      { id: 'delta-reasoning', provider: 'openai_compatible', capabilities: ['chat', 'reasoning'], costTier: 'reasoning', providerModelId: 'gpt-4o' }
    ],
    'delta-fast': [
      { id: 'delta-fast', provider: 'google', capabilities: ['chat'], costTier: 'fast', providerModelId: 'gemini-2.5-flash-lite' },
      { id: 'delta-fast', provider: 'openrouter', capabilities: ['chat'], costTier: 'fast', providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
      { id: 'delta-fast', provider: 'together', capabilities: ['chat'], costTier: 'fast', providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
      { id: 'delta-fast', provider: 'groq', capabilities: ['chat'], costTier: 'fast', providerModelId: 'llama-3.1-8b-instant' },
      { id: 'delta-fast', provider: 'deepseek', capabilities: ['chat'], costTier: 'fast', providerModelId: 'deepseek-chat' },
      { id: 'delta-fast', provider: 'openai_compatible', capabilities: ['chat'], costTier: 'fast', providerModelId: 'gpt-4o-mini' }
    ],
    'delta-classifier': [
      { id: 'delta-classifier', provider: 'google', capabilities: ['chat', 'classification'], costTier: 'cheap', providerModelId: 'gemini-2.5-flash-lite' },
      { id: 'delta-classifier', provider: 'openrouter', capabilities: ['chat', 'classification'], costTier: 'cheap', providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
      { id: 'delta-classifier', provider: 'together', capabilities: ['chat', 'classification'], costTier: 'cheap', providerModelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
      { id: 'delta-classifier', provider: 'groq', capabilities: ['chat', 'classification'], costTier: 'cheap', providerModelId: 'llama-3.1-8b-instant' },
      { id: 'delta-classifier', provider: 'deepseek', capabilities: ['chat', 'classification'], costTier: 'cheap', providerModelId: 'deepseek-chat' },
      { id: 'delta-classifier', provider: 'openai_compatible', capabilities: ['chat', 'classification'], costTier: 'cheap', providerModelId: 'gpt-4o-mini' }
    ]
  };
};

const normalizeProviderName = (provider: string): string => {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'gemini') return 'google';
  if (normalized === 'openai-compatible') return 'openai_compatible';
  return normalized;
};

const isGoogleProvider = (provider: AIProvider): boolean => provider.name === 'google';

const resolveCandidateModelsForProfile = (
  profileId: string,
  providerName: string,
  discoveredIds: string[],
  preferredModelId?: string
): string[] => {
  const fallbackIds = PROVIDER_MODEL_FALLBACKS[providerName]?.[profileId] || [];
  const candidateIds = [...new Set([preferredModelId, ...fallbackIds].filter(Boolean) as string[])];
  if (preferredModelId && preferredModelId.trim()) {
    return candidateIds;
  }

  if (discoveredIds.length === 0) {
    return candidateIds;
  }

  const matched = candidateIds.filter((candidateId) => discoveredIds.includes(candidateId));
  if (matched.length > 0) {
    return matched;
  }

  return discoveredIds[0] ? [discoveredIds[0]] : candidateIds;
};

// Model discovery cache
const modelDiscoveryCache = new Map<string, AIModelDiscovery>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const isModelUnavailableError = (status: number, payload: any): boolean => {
  if (status !== 400 && status !== 404) return false;
  const message = extractErrorMessage(payload).toLowerCase();
  if (!message) return false;
  return (
    message.includes('model') &&
    (
      message.includes('decommission') ||
      message.includes('not found') ||
      message.includes('unavailable') ||
      message.includes('deprecated')
    )
  );
};

const extractErrorMessage = (payload: any): string => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  const nested = payload?.error?.message ?? payload?.message;
  return typeof nested === 'string' ? nested : '';
};

const makeOpenAICompatibleRequest = async (
  provider: AIProvider,
  modelId: string,
  request: AICompletionRequest,
  requestId: string
): Promise<{
  ok: boolean;
  content: string;
  status: number | null;
  error: unknown;
}> => {
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        ...(provider.name === 'openrouter' ? { 'HTTP-Referer': 'https://delta.app' } : {})
      },
      body: JSON.stringify({
        model: modelId,
        messages: request.messages,
        temperature: request.temperature || 0,
        ...(request.responseFormat && { response_format: { type: request.responseFormat } })
      })
    });

    if (!response.ok) {
      const errPayload = await safeJson(response);
      console.warn(`[ai-gateway:${requestId}] provider request failed`, {
        provider: provider.name,
        model: modelId,
        status: response.status,
        error: errPayload
      });
      return {
        ok: false,
        content: '',
        status: response.status,
        error: errPayload
      };
    }

    const parsed = await safeJson(response);
    const content = parsed?.choices?.[0]?.message?.content || '';
    
    return {
      ok: true,
      content: content.trim(),
      status: response.status,
      error: null
    };
  } catch (error) {
    console.warn(`[ai-gateway:${requestId}] provider exception`, {
      provider: provider.name,
      model: modelId,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      ok: false,
      content: '',
      status: null,
      error
    };
  }
};

const buildGoogleRequestBody = (request: AICompletionRequest) => {
  const systemText = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n');

  const contents = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));

  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: '' }] }],
    generationConfig: {
      temperature: request.temperature || 0,
      ...(request.responseFormat
        ? {
            responseMimeType: request.responseFormat === 'json_object' ? 'application/json' : 'text/plain'
          }
        : {})
    }
  };
};

const makeGoogleRequest = async (
  provider: AIProvider,
  modelId: string,
  request: AICompletionRequest,
  requestId: string
): Promise<{
  ok: boolean;
  content: string;
  status: number | null;
  error: unknown;
}> => {
  try {
    const response = await fetch(
      `${provider.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildGoogleRequestBody(request))
      }
    );

    if (!response.ok) {
      const errPayload = await safeJson(response);
      console.warn(`[ai-gateway:${requestId}] provider request failed`, {
        provider: provider.name,
        model: modelId,
        status: response.status,
        error: errPayload
      });
      return {
        ok: false,
        content: '',
        status: response.status,
        error: errPayload
      };
    }

    const parsed = await safeJson(response);
    const parts = Array.isArray(parsed?.candidates?.[0]?.content?.parts)
      ? parsed.candidates[0].content.parts
      : [];
    const content = parts
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    return {
      ok: true,
      content,
      status: response.status,
      error: null
    };
  } catch (error) {
    console.warn(`[ai-gateway:${requestId}] provider exception`, {
      provider: provider.name,
      model: modelId,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      ok: false,
      content: '',
      status: null,
      error
    };
  }
};

const discoverModels = async (provider: AIProvider, requestId: string): Promise<string[]> => {
  const cacheKey = provider.name;
  const cached = modelDiscoveryCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.lastUpdated) < CACHE_TTL_MS) {
    return cached.models.map(m => m.id);
  }

  try {
    if (isGoogleProvider(provider)) {
      const response = await fetch(`${provider.baseUrl}/models?key=${encodeURIComponent(provider.apiKey)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[ai-gateway:${requestId}] model discovery failed`, {
          provider: provider.name,
          status: response.status
        });
        return [];
      }

      const parsed = await safeJson(response);
      const models = Array.isArray(parsed?.models) ? parsed.models : [];

      modelDiscoveryCache.set(cacheKey, {
        provider: provider.name,
        models: models.map((model: any) => ({
          ...model,
          id: String(model?.name || '').replace(/^models\//, '')
        })),
        lastUpdated: Date.now()
      });

      return models.map((m: any) => String(m?.name || '').replace(/^models\//, '')).filter(Boolean);
    }

    const response = await fetch(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`[ai-gateway:${requestId}] model discovery failed`, {
        provider: provider.name,
        status: response.status
      });
      return [];
    }

    const parsed = await safeJson(response);
    const models = Array.isArray(parsed?.data) ? parsed.data : [];
    
    modelDiscoveryCache.set(cacheKey, {
      provider: provider.name,
      models,
      lastUpdated: Date.now()
    });

    return models.map((m: any) => String(m?.id || '')).filter(Boolean);
  } catch (error) {
    console.warn(`[ai-gateway:${requestId}] model discovery exception`, {
      provider: provider.name,
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
};

const safeJson = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getAvailableModelsForProfile = async (
  profileId: string,
  providers: AIProvider[],
  requestId: string
): Promise<Array<{ provider: AIProvider; modelId: string; profile: ModelProfile }>> => {
  const mappings = getModelProfileMappings();
  const profileMappings = mappings[profileId] || [];
  
  const candidates: Array<{ provider: AIProvider; modelId: string; profile: ModelProfile }> = [];

  for (const provider of providers) {
    if (!provider) continue;
    
    const availableModels = await discoverModels(provider, requestId);
    const providerProfiles = profileMappings.filter(p => p.provider === provider.name);
    
    for (const profile of providerProfiles) {
      const candidateModelIds = resolveCandidateModelsForProfile(
        profileId,
        provider.name,
        availableModels,
        profile.providerModelId
      );

      for (const candidateModelId of candidateModelIds) {
        candidates.push({ provider, modelId: candidateModelId, profile });
      }
    }
  }

  return candidates;
};

export const aiGateway = {
  /**
   * Get available models for a specific profile across all configured providers
   */
  async getAvailableModels(profileId: string, requestId: string = crypto.randomUUID()): Promise<string[]> {
    const config = getProviderConfig();
    const providers = [config.primary, config.secondary, config.fallback].filter((p): p is AIProvider => p !== null);
    
    try {
      const candidates = await getAvailableModelsForProfile(profileId, providers, requestId);
      return candidates.map(c => c.modelId);
    } catch (error) {
      console.warn(`[ai-gateway:${requestId}] model discovery failed`, { profileId, error });
      return [];
    }
  },

  /**
   * Create chat completion with automatic fallback across providers
   */
  async createCompletion(request: AICompletionRequest, requestId: string = crypto.randomUUID()): Promise<AICompletionResponse> {
    const config = getProviderConfig();
    const profileId = request.modelProfile || 'delta-general';
    const providers = [config.primary, config.secondary, config.fallback].filter((p): p is AIProvider => p !== null);
    
    if (providers.length === 0) {
      return {
        content: 'AI service unavailable. Please check provider configuration.',
        modelUsed: '',
        providerUsed: '',
        fallbackOccurred: false,
        requestId
      };
    }

    const candidates = await getAvailableModelsForProfile(profileId, providers, requestId);
    const attempted = new Set<string>();
    let fallbackOccurred = false;

    for (const candidate of candidates) {
      const attemptKey = `${candidate.provider.name}:${candidate.modelId}`;
      if (attempted.has(attemptKey)) continue;
      attempted.add(attemptKey);

      try {
        const result = isGoogleProvider(candidate.provider)
          ? await makeGoogleRequest(candidate.provider, candidate.modelId, request, requestId)
          : await makeOpenAICompatibleRequest(candidate.provider, candidate.modelId, request, requestId);
        
        if (result.ok) {
          console.info(`[ai-gateway:${requestId}] completion successful`, {
            provider: candidate.provider.name,
            model: candidate.modelId,
            profile: profileId,
            fallback: fallbackOccurred
          });
          
          return {
            content: result.content,
            modelUsed: candidate.modelId,
            providerUsed: candidate.provider.name,
            fallbackOccurred,
            requestId
          };
        }

        if (isModelUnavailableError(result.status || 0, result.error)) {
          console.warn(`[ai-gateway:${requestId}] model unavailable`, {
            provider: candidate.provider.name,
            model: candidate.modelId,
            status: result.status
          });
          fallbackOccurred = true;
          continue;
        }

        // Provider-level failure, try next provider
        console.warn(`[ai-gateway:${requestId}] provider failed`, {
          provider: candidate.provider.name,
          status: result.status,
          error: result.error
        });
        fallbackOccurred = true;
        break;
      } catch (error) {
        console.warn(`[ai-gateway:${requestId}] provider exception`, {
          provider: candidate.provider.name,
          error: error instanceof Error ? error.message : String(error)
        });
        fallbackOccurred = true;
        continue;
      }
    }

    // All candidates failed
    return {
      content: 'AI service temporarily unavailable. Please try again later.',
      modelUsed: '',
      providerUsed: '',
      fallbackOccurred: true,
      requestId
    };
  },

  /**
   * Get provider configuration status
   */
  getProviderStatus() {
    const config = getProviderConfig();
    return {
      hasPrimary: !!config.primary,
      hasSecondary: !!config.secondary,
      hasFallback: !!config.fallback,
      primaryProvider: config.primary?.name || null,
      secondaryProvider: config.secondary?.name || null,
      fallbackProvider: config.fallback?.name || null
    };
  },

  /**
   * Clear model discovery cache
   */
  clearCache() {
    modelDiscoveryCache.clear();
  }
};

export default aiGateway;
