export const MODELS = {
  synthesis: process.env.SYNTHESIS_MODEL || "claude-opus-5",
  // Modèle Claude de secours quand le fournisseur tiers (ANTHROPIC_BASE_URL) est
  // inutilisable (solde épuisé, compte suspendu). Voir scripts/synthesis-client.ts
  synthesisFallback: process.env.SYNTHESIS_FALLBACK_MODEL || "claude-opus-5",
} as const;
