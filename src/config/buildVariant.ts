// ============================================================================
// Build Variant Configuration
// Controls Public vs Private feature visibility
// ============================================================================
//
// Usage:
//   pnpm tauri dev                           → Public (default)
//   VITE_BUILD_VARIANT=private pnpm tauri dev → Private (all features)
//
// Or set in .env.local:
//   VITE_BUILD_VARIANT=private
//

export type BuildVariant = 'public' | 'private';

export const BUILD_VARIANT: BuildVariant =
  (import.meta.env.VITE_BUILD_VARIANT as BuildVariant) || 'public';

export const isPrivateBuild = BUILD_VARIANT === 'private';
export const isPublicBuild = BUILD_VARIANT === 'public';

// Feature flags derived from build variant
export const features = {
  osint: isPrivateBuild,
  spoof: isPrivateBuild,
  domainHarvest: isPrivateBuild,
  claudeAI: isPrivateBuild,
  dockerIntegration: isPrivateBuild,
} as const;
