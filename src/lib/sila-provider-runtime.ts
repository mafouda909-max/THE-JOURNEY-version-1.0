export interface SilaProviderRuntimeEnv {
  OPENROUTER_API_KEY?: string | null;
  OPENAI_API_KEY?: string | null;
  ANTHROPIC_API_KEY?: string | null;
  VERCEL_AI_GATEWAY_API_KEY?: string | null;
  VERCEL_AI_GATEWAY_KEY?: string | null;
  AI_GATEWAY_API_KEY?: string | null;
  VERCEL_OIDC_TOKEN?: string | null;
  SILA_VERCEL_GATEWAY_ENABLED?: string | null;
}

export type SilaGatewayCredentialSource =
  | "VERCEL_AI_GATEWAY_API_KEY"
  | "VERCEL_AI_GATEWAY_KEY"
  | "AI_GATEWAY_API_KEY"
  | "VERCEL_OIDC_TOKEN";

export interface SilaProviderCredentialState {
  credentialPresent: boolean;
  ready: boolean;
  adapterAvailable: boolean;
}

export interface SilaVercelGatewayState extends SilaProviderCredentialState {
  enabled: boolean;
  credentialSource: SilaGatewayCredentialSource | null;
}

export interface SilaProviderRuntimeState {
  openrouter: SilaProviderCredentialState;
  openai: SilaProviderCredentialState;
  anthropic: SilaProviderCredentialState;
  vercelGateway: SilaVercelGatewayState;
}

function validCredential(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= 10 ? trimmed : null;
}

function truthy(value: string | null | undefined) {
  return value === "true" || value === "1" || value === "yes";
}

export function readSilaProviderRuntimeEnv(
  env: Record<string, string | undefined> = process.env,
): SilaProviderRuntimeEnv {
  return {
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    VERCEL_AI_GATEWAY_API_KEY: env.VERCEL_AI_GATEWAY_API_KEY,
    VERCEL_AI_GATEWAY_KEY: env.VERCEL_AI_GATEWAY_KEY,
    AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY,
    VERCEL_OIDC_TOKEN: env.VERCEL_OIDC_TOKEN,
    SILA_VERCEL_GATEWAY_ENABLED: env.SILA_VERCEL_GATEWAY_ENABLED,
  };
}

function gatewayCredential(
  env: SilaProviderRuntimeEnv,
): { value: string | null; source: SilaGatewayCredentialSource | null; enabled: boolean } {
  const explicitGatewayKey = validCredential(env.VERCEL_AI_GATEWAY_API_KEY);
  if (explicitGatewayKey) {
    return {
      value: explicitGatewayKey,
      source: "VERCEL_AI_GATEWAY_API_KEY",
      enabled: true,
    };
  }

  const legacyExplicitKey = validCredential(env.VERCEL_AI_GATEWAY_KEY);
  if (legacyExplicitKey) {
    return {
      value: legacyExplicitKey,
      source: "VERCEL_AI_GATEWAY_KEY",
      enabled: true,
    };
  }

  const enabled = truthy(env.SILA_VERCEL_GATEWAY_ENABLED);
  if (!enabled) return { value: null, source: null, enabled: false };

  const apiGatewayKey = validCredential(env.AI_GATEWAY_API_KEY);
  if (apiGatewayKey) {
    return {
      value: apiGatewayKey,
      source: "AI_GATEWAY_API_KEY",
      enabled: true,
    };
  }

  const oidcToken = validCredential(env.VERCEL_OIDC_TOKEN);
  if (oidcToken) {
    return {
      value: oidcToken,
      source: "VERCEL_OIDC_TOKEN",
      enabled: true,
    };
  }

  return { value: null, source: null, enabled: true };
}

export function resolveSilaProviderRuntime(
  env: SilaProviderRuntimeEnv = readSilaProviderRuntimeEnv(),
): SilaProviderRuntimeState {
  const openrouterCredential = validCredential(env.OPENROUTER_API_KEY);
  const openaiCredential = validCredential(env.OPENAI_API_KEY);
  const anthropicCredential = validCredential(env.ANTHROPIC_API_KEY);
  const gateway = gatewayCredential(env);

  return {
    openrouter: {
      credentialPresent: Boolean(openrouterCredential),
      ready: Boolean(openrouterCredential),
      adapterAvailable: true,
    },
    openai: {
      credentialPresent: Boolean(openaiCredential),
      ready: Boolean(openaiCredential),
      adapterAvailable: true,
    },
    anthropic: {
      credentialPresent: Boolean(anthropicCredential),
      ready: false,
      adapterAvailable: false,
    },
    vercelGateway: {
      credentialPresent: Boolean(
        validCredential(env.VERCEL_AI_GATEWAY_API_KEY) ||
        validCredential(env.VERCEL_AI_GATEWAY_KEY) ||
        validCredential(env.AI_GATEWAY_API_KEY) ||
        validCredential(env.VERCEL_OIDC_TOKEN)
      ),
      ready: Boolean(gateway.value),
      adapterAvailable: true,
      enabled: gateway.enabled,
      credentialSource: gateway.source,
    },
  };
}

export function resolveVercelGatewayCredential(
  env: SilaProviderRuntimeEnv = readSilaProviderRuntimeEnv(),
): string | null {
  return gatewayCredential(env).value;
}
