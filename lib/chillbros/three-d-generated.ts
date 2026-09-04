export type GeneratedThreeDAsset = {
  builtAt: string;
  webExport: string;
};

// This file is rewritten by scripts/blender/build_assets.py after Blender exports finish.
// Keeping generated state in source control lets the app show real pipeline status instead
// of a permanent hard-coded "Building" label.
export const generatedThreeDAssets: Record<string, GeneratedThreeDAsset> = {};
