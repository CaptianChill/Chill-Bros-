export type ThreeDAssetStatus = "planned" | "building" | "ready";

export type ThreeDAsset = {
  id: string;
  name: string;
  category: "Brand" | "HVAC" | "Refrigeration" | "Cooking" | "Vehicle";
  status: ThreeDAssetStatus;
  source: string;
  webExport: string;
  purpose: string;
};

export const threeDAssets: ThreeDAsset[] = [
  {
    id: "brand-neon-logo",
    name: "Chill Bros Neon Logo",
    category: "Brand",
    status: "building",
    source: "blender/brand/chill-bros-neon-logo.blend",
    webExport: "public/3d/brand/chill-bros-neon-logo.glb",
    purpose: "App hero, loading states, proposals, ads, and branded training scenes.",
  },
  {
    id: "rtu-training-shell",
    name: "Commercial RTU Training Model",
    category: "HVAC",
    status: "planned",
    source: "blender/equipment/hvac/rtu-training-shell.blend",
    webExport: "public/3d/equipment/hvac/rtu-training-shell.glb",
    purpose: "Interactive Chill Bro Bible troubleshooting, component identification, and technician training.",
  },
  {
    id: "reach-in-refrigerator",
    name: "Reach-In Refrigerator Training Model",
    category: "Refrigeration",
    status: "planned",
    source: "blender/equipment/refrigeration/reach-in-training.blend",
    webExport: "public/3d/equipment/refrigeration/reach-in-training.glb",
    purpose: "Refrigeration circuit visualization, component callouts, and field training.",
  },
  {
    id: "commercial-fryer",
    name: "Commercial Fryer Training Model",
    category: "Cooking",
    status: "planned",
    source: "blender/equipment/cooking/commercial-fryer-training.blend",
    webExport: "public/3d/equipment/cooking/commercial-fryer-training.glb",
    purpose: "Gas/electric cooking-equipment service training and component location guidance.",
  },
  {
    id: "service-truck",
    name: "Chill Bros Service Vehicle",
    category: "Vehicle",
    status: "planned",
    source: "blender/vehicles/chill-bros-service-vehicle.blend",
    webExport: "public/3d/vehicles/chill-bros-service-vehicle.glb",
    purpose: "Wrap previews, ads, website scenes, and fleet visualization.",
  },
];
