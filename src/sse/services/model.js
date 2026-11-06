// Re-export from open-sse with localDb integration
import { getModelAliases, getComboByName, getProviderNodes, getProviderConnections } from "@/lib/localDb";
import { parseModel as parseModelCore, resolveModelAliasFromMap, getModelInfoCore } from "open-sse/services/model.js";
import REGISTRY from "open-sse/providers/registry/index.js";

// Local provider alias overrides (HMR-friendly, applied on top of open-sse map)
const LOCAL_PROVIDER_ALIASES = {
  xmtp: "xiaomi-tokenplan",
  "xiaomi-tokenplan": "xiaomi-tokenplan",
};

const RESERVED_PROVIDER_PREFIXES = new Set(Object.keys(LOCAL_PROVIDER_ALIASES));
for (const entry of REGISTRY) {
  RESERVED_PROVIDER_PREFIXES.add(entry.id);
  if (entry.alias) RESERVED_PROVIDER_PREFIXES.add(entry.alias);
  for (const alias of entry.aliases || []) RESERVED_PROVIDER_PREFIXES.add(alias);
}
// Built-ins that authenticate without a stored connection (auth.js injects a
// virtual "noauth" account), so an empty connection table does not mean they
// are unused — they keep their prefix over any same-prefix node.
const NOAUTH_PROVIDER_IDS = new Set(
  REGISTRY.filter((entry) => entry.noAuth && entry.category === "free").map((entry) => entry.id)
);

export function parseModel(modelStr) {
  const parsed = parseModelCore(modelStr);
  if (parsed?.providerAlias && LOCAL_PROVIDER_ALIASES[parsed.providerAlias]) {
    return { ...parsed, provider: LOCAL_PROVIDER_ALIASES[parsed.providerAlias] };
  }
  return parsed;
}

/**
 * Resolve model alias from localDb
 */
export async function resolveModelAlias(alias) {
  const aliases = await getModelAliases();
  return resolveModelAliasFromMap(alias, aliases);
}

/**
 * Compatible node registered under a provider prefix (first matching type wins)
 */
async function findNodeByPrefix(prefix) {
  for (const type of ["openai-compatible", "anthropic-compatible", "custom-embedding"]) {
    const nodes = await getProviderNodes({ type });
    const match = nodes.find((node) => node.prefix === prefix);
    if (match) return match;
  }
  return null;
}

async function hasActiveConnection(provider) {
  const connections = await getProviderConnections({ provider, isActive: true });
  return connections.length > 0;
}

/**
 * Get full model info (parse or resolve)
 */
export async function getModelInfo(modelStr) {
  const parsed = parseModel(modelStr);

  if (!parsed.isAlias) {
    // Provider-node prefixes are user-defined. They must not override built-in
    // provider ids/aliases such as `cf`, `cloudflare-ai`, `openai`, or `hf`.
    if (!RESERVED_PROVIDER_PREFIXES.has(parsed.providerAlias)) {
      const node = await findNodeByPrefix(parsed.providerAlias);
      if (node) {
        return { provider: node.id, model: parsed.model };
      }
      return { provider: parsed.provider, model: parsed.model };
    }

    // Reserved prefix: the built-in provider wins unless it has no live
    // credentials while a node with the same prefix does. A node created before
    // its provider entered the registry (`atria`) owns that prefix in practice,
    // and the built-in would otherwise 404 "No active credentials" (#78).
    if (!NOAUTH_PROVIDER_IDS.has(parsed.provider) && !(await hasActiveConnection(parsed.provider))) {
      const node = await findNodeByPrefix(parsed.providerAlias);
      if (node && (await hasActiveConnection(node.id))) {
        return { provider: node.id, model: parsed.model };
      }
    }
    return { provider: parsed.provider, model: parsed.model };
  }

  // Check if this is a combo name before resolving as alias
  // This prevents combo names from being incorrectly routed to providers
  const combo = await getComboByName(parsed.model);
  if (combo) {
    // Return null provider to signal this should be handled as combo
    // The caller (handleChat) will detect this and handle it as combo
    return { provider: null, model: parsed.model };
  }

  return getModelInfoCore(modelStr, getModelAliases);
}

/**
 * Check if model is a combo and get models list
 * @returns {Promise<string[]|null>} Array of models or null if not a combo
 */
export async function getComboModels(modelStr) {
  // Only check if it's not in provider/model format
  if (modelStr.includes("/")) return null;

  const combo = await getComboByName(modelStr);
  if (combo && combo.models && combo.models.length > 0) {
    return combo.models;
  }
  return null;
}
