type BoxPart = {
  name: string;
  translation: [number, number, number];
  scale: [number, number, number];
  material: number;
};

const CUBE_BUFFER = "AAAAvwAAAL8AAAA/AAAAPwAAAL8AAAA/AAAAPwAAAD8AAAA/AAAAvwAAAD8AAAA/AAAAPwAAAL8AAAC/AAAAvwAAAL8AAAC/AAAAvwAAAD8AAAC/AAAAPwAAAD8AAAC/AAAAPwAAAL8AAAA/AAAAPwAAAL8AAAC/AAAAPwAAAD8AAAC/AAAAPwAAAD8AAAA/AAAAvwAAAL8AAAC/AAAAvwAAAL8AAAA/AAAAvwAAAD8AAAA/AAAAvwAAAD8AAAC/AAAAvwAAAD8AAAA/AAAAPwAAAD8AAAA/AAAAPwAAAD8AAAC/AAAAvwAAAD8AAAC/AAAAvwAAAL8AAAC/AAAAPwAAAL8AAAC/AAAAPwAAAL8AAAA/AAAAvwAAAL8AAAA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAABAAIAAAACAAMABAAFAAYABAAGAAcACAAJAAoACAAKAAsADAANAA4ADAAOAA8AEAARABIAEAASABMAFAAVABYAFAAWABcA";

const MATERIALS = [
  { name: "Cabinet steel", pbrMetallicRoughness: { baseColorFactor: [0.34, 0.42, 0.52, 1], metallicFactor: 0.72, roughnessFactor: 0.34 } },
  { name: "Chill Bros ice blue", pbrMetallicRoughness: { baseColorFactor: [0.08, 0.55, 1, 1], metallicFactor: 0.25, roughnessFactor: 0.24 }, emissiveFactor: [0.02, 0.17, 0.38] },
  { name: "Electrical", pbrMetallicRoughness: { baseColorFactor: [0.08, 0.11, 0.17, 1], metallicFactor: 0.18, roughnessFactor: 0.42 } },
  { name: "Copper / hot circuit", pbrMetallicRoughness: { baseColorFactor: [0.64, 0.26, 0.12, 1], metallicFactor: 0.72, roughnessFactor: 0.28 } },
  { name: "Safety / sensor", pbrMetallicRoughness: { baseColorFactor: [0.05, 0.72, 0.48, 1], metallicFactor: 0.12, roughnessFactor: 0.32 }, emissiveFactor: [0.01, 0.12, 0.06] },
  { name: "Service highlight", pbrMetallicRoughness: { baseColorFactor: [0.62, 0.92, 1, 1], metallicFactor: 0.12, roughnessFactor: 0.22 }, emissiveFactor: [0.12, 0.32, 0.42] },
];

const MODELS: Record<string, BoxPart[]> = {
  rtu: [
    { name: "RTU_CABINET", translation: [0, 0, 0], scale: [4.6, 1.05, 2.65], material: 0 },
    { name: "CONDENSER_SECTION", translation: [1.35, 0.62, 0.25], scale: [1.55, 0.18, 1.65], material: 1 },
    { name: "COMP_COMPRESSOR", translation: [1.45, -0.72, -0.48], scale: [0.72, 0.72, 0.92], material: 3 },
    { name: "COMP_CONTACTOR", translation: [-0.25, -0.8, 0.62], scale: [0.42, 0.18, 0.58], material: 2 },
    { name: "COMP_TRANSFORMER", translation: [-0.95, -0.8, 0.55], scale: [0.52, 0.18, 0.48], material: 5 },
    { name: "COMP_CONTROL_BOARD", translation: [-1.62, -0.8, 0.48], scale: [0.68, 0.12, 0.78], material: 1 },
    { name: "COMP_HIGH_PRESSURE_SWITCH", translation: [1.75, -0.78, 0.28], scale: [0.22, 0.2, 0.22], material: 4 },
    { name: "COMP_LOW_PRESSURE_SWITCH", translation: [0.92, -0.78, 0.15], scale: [0.22, 0.2, 0.22], material: 4 },
    { name: "COMP_EVAPORATOR", translation: [-1.15, 0.62, -0.18], scale: [1.4, 0.18, 1.55], material: 5 },
    { name: "COMP_TXV", translation: [-0.1, -0.72, -0.42], scale: [0.24, 0.24, 0.3], material: 3 },
  ],
  "reach-in": [
    { name: "REACH_IN_CABINET", translation: [0, 0, 0.5], scale: [2.6, 1.45, 4.6], material: 0 },
    { name: "DOOR", translation: [0, -0.82, 0.75], scale: [2.2, 0.12, 3.55], material: 1 },
    { name: "COMP_COMPRESSOR", translation: [-0.65, -0.8, -1.35], scale: [0.62, 0.5, 0.7], material: 3 },
    { name: "COMP_CONDENSER", translation: [0.55, -0.82, -1.3], scale: [0.9, 0.14, 0.65], material: 5 },
    { name: "COMP_FILTER_DRIER", translation: [0.05, -0.93, -0.78], scale: [0.16, 0.16, 0.62], material: 3 },
    { name: "COMP_METERING_DEVICE", translation: [-0.45, -0.93, 0.2], scale: [0.22, 0.18, 0.28], material: 4 },
    { name: "COMP_EVAPORATOR", translation: [0, 0.3, 1.5], scale: [1.65, 0.44, 0.55], material: 5 },
  ],
  "ice-machine": [
    { name: "ICE_MACHINE_CABINET", translation: [0, 0, 0.25], scale: [3.0, 1.65, 3.8], material: 0 },
    { name: "SERVICE_PANEL", translation: [0, -0.93, 0.2], scale: [2.55, 0.12, 2.8], material: 1 },
    { name: "COMP_EVAPORATOR", translation: [0, -1.02, 0.85], scale: [1.8, 0.12, 0.72], material: 5 },
    { name: "COMP_CONTROL_BOARD", translation: [-0.85, -1.04, -0.35], scale: [0.6, 0.1, 0.75], material: 2 },
    { name: "COMP_SENSOR_HARNESS", translation: [0, -1.06, -0.22], scale: [0.12, 0.08, 1.15], material: 4 },
    { name: "COMP_TEMPERATURE_PROBE", translation: [0.62, -1.08, 0.65], scale: [0.16, 0.12, 0.36], material: 4 },
    { name: "WATER_SUMP", translation: [0, -0.55, -1.12], scale: [1.75, 0.72, 0.55], material: 1 },
  ],
  fryer: [
    { name: "FRYER_BODY", translation: [0, 0, 0], scale: [2.7, 1.65, 3.45], material: 0 },
    { name: "FRY_VAT", translation: [0, 0.05, 1.2], scale: [2.1, 1.25, 0.72], material: 5 },
    { name: "CONTROL_FACE", translation: [0, -0.94, 0.55], scale: [2.0, 0.12, 0.72], material: 1 },
    { name: "COMP_THERMOSTAT", translation: [-0.65, -1.04, 0.52], scale: [0.28, 0.12, 0.28], material: 2 },
    { name: "COMP_HIGH_LIMIT", translation: [0.62, -1.04, 0.52], scale: [0.28, 0.12, 0.28], material: 4 },
    { name: "COMP_GAS_VALVE", translation: [0.6, -0.9, -0.65], scale: [0.55, 0.35, 0.4], material: 3 },
    { name: "COMP_IGNITER_PILOT", translation: [-0.55, -0.92, -0.72], scale: [0.24, 0.25, 0.3], material: 5 },
    { name: "COMP_FLAME_SAFETY", translation: [-0.95, -0.92, -0.35], scale: [0.22, 0.2, 0.35], material: 4 },
    { name: "BURNER_BANK", translation: [0, 0.1, -1.05], scale: [1.8, 0.92, 0.42], material: 3 },
  ],
};

function makeGltf(parts: BoxPart[]) {
  const meshes = MATERIALS.map((_, materialIndex) => ({
    name: `BOX_MATERIAL_${materialIndex}`,
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: materialIndex }],
  }));

  return {
    asset: { version: "2.0", generator: "Chill Bros Training Model Generator" },
    scene: 0,
    scenes: [{ nodes: parts.map((_, index) => index) }],
    nodes: parts.map((part) => ({ name: part.name, mesh: part.material, translation: part.translation, scale: part.scale })),
    materials: MATERIALS,
    meshes,
    buffers: [{ uri: `data:application/octet-stream;base64,${CUBE_BUFFER}`, byteLength: 648 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 288, target: 34962 },
      { buffer: 0, byteOffset: 288, byteLength: 288, target: 34962 },
      { buffer: 0, byteOffset: 576, byteLength: 72, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parts = MODELS[slug];
  if (!parts) return new Response("Training model not found.", { status: 404 });

  return new Response(JSON.stringify(makeGltf(parts)), {
    headers: {
      "Content-Type": "model/gltf+json; charset=utf-8",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
