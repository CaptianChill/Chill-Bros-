import { generatedThreeDAssets } from "@/lib/chillbros/three-d-generated";

export type ThreeDAssetStatus = "blocked" | "queued" | "building" | "ready";

export type ThreeDAsset = {
  id: string;
  name: string;
  category: "Brand" | "HVAC" | "Refrigeration" | "Cooking" | "Vehicle";
  status: ThreeDAssetStatus;
  progress: number;
  source: string;
  webExport: string;
  purpose: string;
  nextStep: string;
  modelSlug?: string;
  builtAt: string | null;
};

type ThreeDAssetSeed = Omit<ThreeDAsset, "builtAt">;

const assetSeeds: ThreeDAssetSeed[] = [
  {
    id: "brand-neon-logo",
    name: "Chill Bros Neon Logo",
    category: "Brand",
    status: "queued",
    progress: 20,
    source: "scripts/blender/build_assets.py · public/logo.png",
    webExport: "public/3d/brand/chill-bros-neon-logo.glb",
    purpose: "App hero, loading states, proposals, ads, and branded training scenes.",
    nextStep: "Run the automated Blender build. The official app logo is used as the sign face.",
  },
  {
    id: "rtu-training-shell",
    name: "Commercial RTU Training Model",
    category: "HVAC",
    status: "queued",
    progress: 20,
    source: "scripts/blender/build_assets.py · build_rtu()",
    webExport: "public/3d/equipment/hvac/rtu-training-shell.glb",
    purpose: "Interactive Chill Bro Bible troubleshooting, component identification, and technician training.",
    nextStep: "Generate the Blender GLB and let the Training Center switch from schematic geometry automatically.",
    modelSlug: "rtu",
  },
  {
    id: "reach-in-refrigerator",
    name: "Reach-In Refrigerator Training Model",
    category: "Refrigeration",
    status: "queued",
    progress: 20,
    source: "scripts/blender/build_assets.py · build_reach_in()",
    webExport: "public/3d/equipment/refrigeration/reach-in-training.glb",
    purpose: "Refrigeration circuit visualization, component callouts, and field training.",
    nextStep: "Generate the Blender GLB and publish it into the existing rotatable training viewer.",
    modelSlug: "reach-in",
  },
  {
    id: "ice-machine-training",
    name: "Commercial Ice Machine Training Model",
    category: "Refrigeration",
    status: "queued",
    progress: 20,
    source: "scripts/blender/build_assets.py · build_ice_machine()",
    webExport: "public/3d/equipment/ice/ice-machine-training.glb",
    purpose: "Ice-machine component identification, sensor training, water-system orientation, and recurring field-case walkthroughs.",
    nextStep: "Generate the Blender GLB and publish it into the Chill Bros Bible viewer.",
    modelSlug: "ice-machine",
  },
  {
    id: "commercial-fryer",
    name: "Commercial Fryer Training Model",
    category: "Cooking",
    status: "queued",
    progress: 20,
    source: "scripts/blender/build_assets.py · build_fryer()",
    webExport: "public/3d/equipment/cooking/commercial-fryer-training.glb",
    purpose: "Gas/electric cooking-equipment service training and component location guidance.",
    nextStep: "Generate the Blender GLB and publish it into the existing rotatable training viewer.",
    modelSlug: "fryer",
  },
  {
    id: "service-truck",
    name: "Chill Bros Toyota Tundra Work Truck",
    category: "Vehicle",
    status: "queued",
    progress: 20,
    source: "scripts/blender/build_actual_work_truck.py · photo-referenced exterior",
    webExport: "public/3d/vehicles/chill-bros-service-vehicle.glb",
    purpose: "Photo-referenced fleet visualization of the current gray Toyota Tundra Double Cab work truck for wrap previews, branding mockups, ads, and website scenes.",
    nextStep: "Rebuild the photo-referenced Tundra model whenever the real truck, wheels, accessories, or Chill Bros wrap changes.",
  },
];

export const threeDAssets: ThreeDAsset[] = assetSeeds.map((asset) => {
  const generated = generatedThreeDAssets[asset.id];
  if (!generated) return { ...asset, builtAt: null };

  return {
    ...asset,
    status: "ready",
    progress: 100,
    webExport: generated.webExport,
    builtAt: generated.builtAt,
    nextStep: "Blender export is built and available to the Chill Bros app.",
  };
});

export function getTrainingModelSource(modelSlug: string) {
  const asset = threeDAssets.find((item) => item.modelSlug === modelSlug);
  if (!asset || asset.status !== "ready") return `/training/model/${modelSlug}`;
  return `/${asset.webExport.replace(/^public\//, "")}`;
}

export function isProductionTrainingModel(modelSlug: string) {
  return threeDAssets.some((item) => item.modelSlug === modelSlug && item.status === "ready");
}
