// Centralized model configuration for Anthropic API calls.
// Update here when migrating models — no need to grep the codebase.
// SYNTHESIS_MODEL permet de basculer la synthèse sur un autre modèle
// (ex: kimi-k3 via l'endpoint Anthropic-compatible de Moonshot) sans toucher au code.
export const MODELS = {
  // Rédaction analytique multi-sources, qualité maximale
  synthesis: process.env.SYNTHESIS_MODEL || "claude-opus-5",
} as const;
