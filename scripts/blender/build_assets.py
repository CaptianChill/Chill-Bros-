from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import math

import bpy

ROOT = Path(__file__).resolve().parents[2]
BLEND_OUTPUT = ROOT / "blender" / "build-output"
GENERATED_MANIFEST = ROOT / "lib" / "chillbros" / "three-d-generated.ts"

BUILT: list[tuple[str, str]] = []


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def material(
    name: str,
    rgba: tuple[float, float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.45,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.diffuse_color = rgba
    mat.metallic = metallic
    mat.roughness = roughness
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = rgba
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if emission:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = emission
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = emission
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign(obj, mat) -> None:
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def add_box(name: str, location, dimensions, mat, bevel: float = 0.0):
    bpy.ops.mesh.primitive_cube_add(size=2, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    if bevel:
        modifier = obj.modifiers.new(name="Service edge", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    return obj


def add_cylinder(name: str, location, radius: float, depth: float, mat, rotation=(0.0, 0.0, 0.0), vertices: int = 32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return obj


def palette():
    return {
        "cabinet": material("Cabinet steel", (0.19, 0.25, 0.34, 1.0), metallic=0.72, roughness=0.3),
        "ice": material("Chill Bros ice blue", (0.05, 0.48, 1.0, 1.0), metallic=0.28, roughness=0.2, emission=(0.03, 0.32, 1.0, 1.0), emission_strength=1.6),
        "electrical": material("Electrical", (0.035, 0.055, 0.09, 1.0), metallic=0.18, roughness=0.4),
        "copper": material("Copper hot circuit", (0.55, 0.19, 0.07, 1.0), metallic=0.74, roughness=0.25),
        "sensor": material("Safety sensor", (0.02, 0.58, 0.36, 1.0), metallic=0.1, roughness=0.3, emission=(0.01, 0.18, 0.07, 1.0), emission_strength=0.8),
        "highlight": material("Service highlight", (0.56, 0.9, 1.0, 1.0), metallic=0.12, roughness=0.2, emission=(0.12, 0.48, 0.6, 1.0), emission_strength=1.1),
        "tire": material("Tire", (0.018, 0.02, 0.025, 1.0), metallic=0.0, roughness=0.72),
        "glass": material("Glass tint", (0.025, 0.09, 0.15, 1.0), metallic=0.15, roughness=0.18),
    }


def export_asset(asset_id: str, web_export: str, blend_name: str) -> None:
    glb_path = ROOT / web_export
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    BLEND_OUTPUT.mkdir(parents=True, exist_ok=True)
    blend_path = BLEND_OUTPUT / blend_name

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
    )
    BUILT.append((asset_id, web_export))


def build_brand_logo() -> None:
    clear_scene()
    p = palette()
    add_box("CHILL_BROS_SIGN_BACKING", (0, 0.2, 0), (7.2, 0.42, 4.2), p["electrical"], bevel=0.12)
    add_box("CHILL_BROS_SIGN_GLOW", (0, -0.05, 0), (6.75, 0.08, 3.75), p["ice"], bevel=0.08)

    logo_path = ROOT / "public" / "logo.png"
    if logo_path.exists():
        bpy.ops.mesh.primitive_plane_add(size=2, location=(0, -0.11, 0), rotation=(math.radians(90), 0, 0))
        plane = bpy.context.object
        plane.name = "CHILL_BROS_OFFICIAL_LOGO_FACE"
        plane.scale = (3.15, 1.65, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        logo_mat = bpy.data.materials.new(name="Official Chill Bros logo")
        logo_mat.use_nodes = True
        nodes = logo_mat.node_tree.nodes
        links = logo_mat.node_tree.links
        bsdf = nodes.get("Principled BSDF")
        image_node = nodes.new("ShaderNodeTexImage")
        image_node.image = bpy.data.images.load(str(logo_path))
        links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
        if "Alpha" in image_node.outputs and "Alpha" in bsdf.inputs:
            links.new(image_node.outputs["Alpha"], bsdf.inputs["Alpha"])
        if "Emission Color" in bsdf.inputs:
            links.new(image_node.outputs["Color"], bsdf.inputs["Emission Color"])
        elif "Emission" in bsdf.inputs:
            links.new(image_node.outputs["Color"], bsdf.inputs["Emission"])
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 1.9
        if hasattr(logo_mat, "blend_method"):
            logo_mat.blend_method = "BLEND"
        assign(plane, logo_mat)

    export_asset("brand-neon-logo", "public/3d/brand/chill-bros-neon-logo.glb", "chill-bros-neon-logo.blend")


def build_rtu() -> None:
    clear_scene()
    p = palette()
    add_box("RTU_CABINET", (0, 0, 0), (4.6, 1.05, 2.65), p["cabinet"], bevel=0.06)
    add_box("CONDENSER_SECTION", (1.35, 0.62, 0.25), (1.55, 0.18, 1.65), p["ice"])
    add_cylinder("COMP_COMPRESSOR", (1.45, -0.72, -0.48), 0.48, 0.9, p["copper"])
    add_box("COMP_CONTACTOR", (-0.25, -0.8, 0.62), (0.42, 0.18, 0.58), p["electrical"])
    add_box("COMP_TRANSFORMER", (-0.95, -0.8, 0.55), (0.52, 0.18, 0.48), p["highlight"])
    add_box("COMP_CONTROL_BOARD", (-1.62, -0.8, 0.48), (0.68, 0.12, 0.78), p["ice"])
    add_box("COMP_Y_INPUT", (-1.96, -0.82, 0.86), (0.2, 0.12, 0.18), p["sensor"])
    add_cylinder("COMP_RUN_CAPACITOR", (0.35, -0.8, 0.75), 0.18, 0.52, p["highlight"])
    add_cylinder("COMP_HIGH_PRESSURE_SWITCH", (1.75, -0.78, 0.28), 0.14, 0.2, p["sensor"])
    add_cylinder("COMP_LOW_PRESSURE_SWITCH", (0.92, -0.78, 0.15), 0.14, 0.2, p["sensor"])
    add_box("COMP_EVAPORATOR", (-1.15, 0.62, -0.18), (1.4, 0.18, 1.55), p["highlight"])
    add_cylinder("COMP_TXV", (-0.1, -0.72, -0.42), 0.16, 0.3, p["copper"])
    add_cylinder("COMP_FILTER_DRIER", (0.48, -0.72, -0.28), 0.1, 0.62, p["copper"])
    add_cylinder("COMP_CONDENSER_FAN_MOTOR", (1.35, 0.82, 0.75), 0.36, 0.3, p["highlight"], rotation=(math.radians(90), 0, 0))
    add_cylinder("COMP_BLOWER_MOTOR", (-1.55, 0.08, -0.82), 0.38, 0.52, p["ice"], rotation=(math.radians(90), 0, 0))
    add_box("COMP_CONDENSATE_DRAIN", (-2.05, -0.45, -1.02), (0.42, 0.32, 0.22), p["sensor"])
    export_asset("rtu-training-shell", "public/3d/equipment/hvac/rtu-training-shell.glb", "rtu-training-shell.blend")


def build_reach_in() -> None:
    clear_scene()
    p = palette()
    add_box("REACH_IN_CABINET", (0, 0, 0.5), (2.6, 1.45, 4.6), p["cabinet"], bevel=0.05)
    add_box("DOOR", (0, -0.82, 0.75), (2.2, 0.12, 3.55), p["ice"])
    add_cylinder("COMP_COMPRESSOR", (-0.65, -0.8, -1.35), 0.42, 0.7, p["copper"])
    add_box("COMP_CONDENSER", (0.55, -0.82, -1.3), (0.9, 0.14, 0.65), p["highlight"])
    add_cylinder("COMP_FILTER_DRIER", (0.05, -0.93, -0.78), 0.1, 0.62, p["copper"])
    add_cylinder("COMP_METERING_DEVICE", (-0.45, -0.93, 0.2), 0.12, 0.28, p["sensor"])
    add_box("COMP_EVAPORATOR", (0, 0.3, 1.5), (1.65, 0.44, 0.55), p["highlight"])
    export_asset("reach-in-refrigerator", "public/3d/equipment/refrigeration/reach-in-training.glb", "reach-in-training.blend")


def build_ice_machine() -> None:
    clear_scene()
    p = palette()
    add_box("ICE_MACHINE_CABINET", (0, 0, 0.25), (3.0, 1.65, 3.8), p["cabinet"], bevel=0.05)
    add_box("SERVICE_PANEL", (0, -0.93, 0.2), (2.55, 0.12, 2.8), p["ice"])
    add_box("COMP_EVAPORATOR", (0, -1.02, 0.85), (1.8, 0.12, 0.72), p["highlight"])
    add_box("COMP_CONTROL_BOARD", (-0.85, -1.04, -0.35), (0.6, 0.1, 0.75), p["electrical"])
    add_box("COMP_SENSOR_HARNESS", (0, -1.06, -0.22), (0.12, 0.08, 1.15), p["sensor"])
    add_cylinder("COMP_TEMPERATURE_PROBE", (0.62, -1.08, 0.65), 0.09, 0.36, p["sensor"])
    add_box("WATER_SUMP", (0, -0.55, -1.12), (1.75, 0.72, 0.55), p["ice"])
    export_asset("ice-machine-training", "public/3d/equipment/ice/ice-machine-training.glb", "ice-machine-training.blend")


def build_fryer() -> None:
    clear_scene()
    p = palette()
    add_box("FRYER_BODY", (0, 0, 0), (2.7, 1.65, 3.45), p["cabinet"], bevel=0.05)
    add_box("FRY_VAT", (0, 0.05, 1.2), (2.1, 1.25, 0.72), p["highlight"])
    add_box("CONTROL_FACE", (0, -0.94, 0.55), (2.0, 0.12, 0.72), p["ice"])
    add_box("COMP_THERMOSTAT", (-0.65, -1.04, 0.52), (0.28, 0.12, 0.28), p["electrical"])
    add_box("COMP_HIGH_LIMIT", (0.62, -1.04, 0.52), (0.28, 0.12, 0.28), p["sensor"])
    add_box("COMP_GAS_VALVE", (0.6, -0.9, -0.65), (0.55, 0.35, 0.4), p["copper"])
    add_cylinder("COMP_IGNITER_PILOT", (-0.55, -0.92, -0.72), 0.15, 0.3, p["highlight"])
    add_box("COMP_FLAME_SAFETY", (-0.95, -0.92, -0.35), (0.22, 0.2, 0.35), p["sensor"])
    add_box("BURNER_BANK", (0, 0.1, -1.05), (1.8, 0.92, 0.42), p["copper"])
    export_asset("commercial-fryer", "public/3d/equipment/cooking/commercial-fryer-training.glb", "commercial-fryer-training.blend")


def build_service_vehicle() -> None:
    clear_scene()
    p = palette()
    add_box("TRUCK_BODY", (0, 0, 0.7), (5.2, 2.0, 1.25), p["cabinet"], bevel=0.08)
    add_box("TRUCK_CAB", (-1.2, 0, 1.55), (2.15, 1.9, 1.4), p["ice"], bevel=0.08)
    add_box("WINDSHIELD", (-1.35, -0.98, 1.72), (1.45, 0.06, 0.7), p["glass"])
    add_box("SERVICE_BOX", (1.2, 0, 1.35), (2.35, 1.88, 1.4), p["electrical"], bevel=0.06)
    for x in (-1.65, 1.65):
        for y in (-1.02, 1.02):
            add_cylinder(f"WHEEL_{x}_{y}", (x, y, 0.2), 0.45, 0.26, p["tire"], rotation=(math.radians(90), 0, 0))
    add_box("CHILL_BROS_SIDE_BADGE", (0.95, -0.98, 1.38), (1.75, 0.05, 0.72), p["highlight"])
    export_asset("service-truck", "public/3d/vehicles/chill-bros-service-vehicle.glb", "chill-bros-service-vehicle.blend")


def write_generated_manifest() -> None:
    built_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    lines = [
        "export type GeneratedThreeDAsset = {",
        "  builtAt: string;",
        "  webExport: string;",
        "};",
        "",
        "// AUTO-GENERATED by scripts/blender/build_assets.py. Do not hand-edit build state.",
        "export const generatedThreeDAssets: Record<string, GeneratedThreeDAsset> = {",
    ]
    for asset_id, web_export in BUILT:
        lines.append(f'  "{asset_id}": {{ builtAt: "{built_at}", webExport: "{web_export}" }},')
    lines.extend(["};", ""])
    GENERATED_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    GENERATED_MANIFEST.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    build_brand_logo()
    build_rtu()
    build_reach_in()
    build_ice_machine()
    build_fryer()
    build_service_vehicle()
    write_generated_manifest()
    print(f"Chill Bros Blender pipeline built {len(BUILT)} assets.")


if __name__ == "__main__":
    main()
