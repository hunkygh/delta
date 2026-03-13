interface AIProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

interface AICompletionRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  modelProfile?: string;
  maxTokens?: number;
}

interface AICompletionResponse {
  content: string;
  modelUsed: string;
  providerUsed: string;
  fallbackOccurred: boolean;
  requestId: string;
  discoveryMode: 'live' | 'static';
}

interface ProviderModelDiscoveryCache {
  expiresAt: number;
  ids: string[];
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const modelCache = new Map<string, ProviderModelDiscoveryCache>();

const DEFAULT_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  openai_compatible: 'https://api.openai.com/v1',
  openai: 'https://api.openai.com/v1'
};

const DEFAULT_PROFILE_MODELS: Record<string, Record<string, string>> = {
  'delta-general': {
    openrouter: 'anthropic/claude-3.5-sonnet',
    together: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    openai_compatible: 'gpt-4o',
    openai: 'gpt-4o'
  },
  'delta-cheap': {
    openrouter: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    openai_compatible: 'gpt-4o-mini',
    openai: 'gpt-4o-mini'
  },
  'delta-reasoning': {
    openrouter: 'openai/gpt-4o',
    together: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    openai_compatible: 'gpt-4o',
    openai: 'gpt-4o'
  },
  'delta-fast': {
    openrouter: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    openai_compatible: 'gpt-4o-mini',
    openai: 'gpt-4o-mini'
  },
  'delta-classifier': {
    openrouter: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    openai_compatible: 'gpt-4o-mini',
    openai: 'gpt-4o-mini'
  }
};

const normalizeProviderName = (provider: string | null | undefined): string | null => {
  if (!provider) return null;
  const normalized = provider.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'openai-compatible') return 'openai_compatible';
  return normalized;
};

const getProfileOverride = (profileId: string): string | null => {
  const envMap: Record<string, string> = {
    'delta-general': 'AI_MODEL_PROFILE_GENERAL',
    'delta-cheap': 'AI_MODEL_PROFILE_CHEAP',
    'delta-reasoning': 'AI_MODEL_PROFILE_REASONING',
    'delta-fast': 'AI_MODEL_PROFILE_FAST',
    'delta-classifier': 'AI_MODEL_PROFILE_CLASSIFIER'
  };
  const envKey = envMap[profileId];
  if (!envKey) return null;
  const override = Deno.env.get(envKey);
  return override && override.trim() ? override.trim() : null;
};

const resolveModelForProfile = (profileId: string, providerName: string): string | null => {
  const override = getProfileOverride(profileId);
  if (override) return override;
  const profile = DEFAULT_PROFILE_MODELS[profileId];
  if (!profile) return null;
  return profile[providerName] || null;
};

const buildProviderConfig = (slot: 'PRIMARY' | 'SECONDARY' | 'FALLBACK'): AIProviderConfig | null => {
  const providerName = normalizeProviderName(Deno.env.get(`AI_PROVIDER_${slot}`));
  const apiKey = Deno.env.get(`AI_API_KEY_${slot}`)?.trim() || '';
  if (!providerName || !apiKey) return null;
  const baseUrl =
    Deno.env.get(`AI_BASE_URL_${slot}`)?.trim() ||
    DEFAULT_BASE_URLS[providerName] ||
    DEFAULT_BASE_URLS.openai_compatible;
  return { name: providerName, baseUrl, apiKey };
};

const getProviderChain = (): AIProviderConfig[] =>
  [buildProviderConfig('PRIMARY'), buildProviderConfig('SECONDARY'), buildProviderConfig('FALLBACK')].filter(
    Boolean
  ) as AIProviderConfig[];

const safeJson = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const extractErrorMessage = (payload: unknown): string => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  const nested =
    (payload as Record<string, unknown>)?.error &&
    typeof (payload as Record<string, unknown>).error === 'object'
      ? ((payload as Record<string, any>).error?.message as string | undefined)
      : undefined;
  const direct = (payload as Record<string, any>)?.message;
  return typeof nested === 'string' ? nested : typeof direct === 'string' ? direct : '';
};

const isModelUnavailableError = (status: number | null, payload: unknown): boolean => {
  if (status !== 400 && status !== 404) return false;
  const message = extractErrorMessage(payload).toLowerCase();
  if (!message) return false;
  return (
    message.includes('model') &&
    (message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('deprecated') ||
      message.includes('decommission') ||
      message.includes('unavailable') ||
      message.includes('invalid'))
  );
};

const fetchProviderModelIds = async (
  provider: AIProviderConfig,
  requestId: string,
  forceRefresh = false
): Promise<{ ids: string[]; discoveryMode: 'live' | 'static' }> => {
  const cacheKey = `${provider.name}:${provider.baseUrl}`;
  const cached = modelCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { ids: cached.ids, discoveryMode: 'live' };
  }

  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      console.warn(`[ai-gateway:${requestId}] model discovery failed`, {
        provider: provider.name,
        status: response.status
      });
      return { ids: [], discoveryMode: 'static' };
    }

    const parsed = await safeJson(response);
    const data = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
    const ids = data.map((entry: any) => String(entry?.id || '')).filter(Boolean);
    modelCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      ids
    });
    return { ids, discoveryMode: 'live' };
  } catch (error) {
    console.warn(`[ai-gateway:${requestId}] model discovery exception`, {
      provider: provider.name,
      error: error instanceof Error ? error.message : String(error)
    });
    return { ids: [], discoveryMode: 'static' };
  }
};

const buildRequestBody = (modelId: string, request: AICompletionRequest) => ({
  model: modelId,
  messages: request.messages,
  temperature: request.temperature ?? 0,
  ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
  ...(request.responseFormat ? { response_format: { type: request.responseFormat } } : {})
});

const makeCompletionRequest = async (
  provider: AIProviderConfig,
  modelId: string,
  request: AICompletionRequest,
  requestId: string
): Promise<{ ok: boolean; content: string; status: number | null; error: unknown }> => {
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        ...(provider.name === 'openrouter' ? { 'HTTP-Referer': 'https://delta.app' } : {})
      },
      body: JSON.stringify(buildRequestBody(modelId, request))
    });

    if (!response.ok) {
      const error = await safeJson(response);
      return { ok: false, content: '', status: response.status, error };
    }

    const parsed = await safeJson(response);
    const content = parsed?.choices?.[0]?.message?.content?.trim?.() || '';
    return { ok: Boolean(content), content, status: response.status, error: content ? null : 'empty_completion' };
  } catch (error) {
    return { ok: false, content: '', status: null, error };
  }
};

export const aiGateway = {
  async getAvailableModels(profileId: string, requestId = crypto.randomUUID()): Promise<string[]> {
    const providers = getProviderChain();
    const models = await Promise.all(
      providers.map(async (provider) => {
        const configured = resolveModelForProfile(profileId, provider.name);
        if (!configured) return [];
        const discovered = await fetchProviderModelIds(provider, requestId);
        if (discovered.ids.length === 0) return [configured];
        return discovered.ids.includes(configured) ? [configured] : [];
      })
    );
    return models.flat();
  },

  async createCompletion(
    request: AICompletionRequest,
    requestId = crypto.randomUUID()
  ): Promise<AICompletionResponse> {
    const providers = getProviderChain();
    const profileId = request.modelProfile || 'delta-general';
    if (providers.length === 0) {
      return {
        content: '',
        modelUsed: '',
        providerUsed: '',
        fallbackOccurred: false,
        requestId,
        discoveryMode: 'static'
      };
    }

    let fallbackOccurred = false;

    for (const provider of providers) {
      const configuredModel = resolveModelForProfile(profileId, provider.name);
      if (!configuredModel) continue;

      const discovery = await fetchProviderModelIds(provider, requestId);
      const candidates =
        discovery.ids.length > 0 && discovery.ids.includes(configuredModel) ? [configuredModel] : [configuredModel];

      for (const modelId of candidates) {
        const result = await makeCompletionRequest(provider, modelId, request, requestId);
        if (result.ok) {
          console.info(`[ai-gateway:${requestId}] completion successful`, {
            provider: provider.name,
            model: modelId,
            profile: profileId,
            fallback: fallbackOccurred,
            discovery: discovery.discoveryMode
          });
          return {
            content: result.content,
            modelUsed: modelId,
            providerUsed: provider.name,
            fallbackOccurred,
            requestId,
            discoveryMode: discovery.discoveryMode
          };
        }

        console.warn(`[ai-gateway:${requestId}] candidate failed`, {
          provider: provider.name,
          model: modelId,
          profile: profileId,
          status: result.status,
          error: extractErrorMessage(result.error) || result.error
        });

        if (!isModelUnavailableError(result.status, result.error)) {
          fallbackOccurred = true;
          break;
        }

        fallbackOccurred = true;
      }
    }

    return {
      content: '',
      modelUsed: '',
      providerUsed: '',
      fallbackOccurred: true,
      requestId,
      discoveryMode: 'static'
    };
  }
};
