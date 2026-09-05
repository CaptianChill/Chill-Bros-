from __future__ import annotations

from pathlib import Path
import math

import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT_GLB = ROOT / "public" / "3d" / "vehicles" / "chill-bros-service-vehicle.glb"
OUT_BLEND = ROOT / "blender" / "build-output" / "chill-bros-service-vehicle.blend"


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def mat(name, rgba, metallic=0.0, roughness=0.4, emission=None, strength=0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = rgba
    material.metallic = metallic
    material.roughness = roughness
    bsdf = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = emission
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = emission
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = strength
    return material


def assign(obj, material):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(material)


def box(name, loc, dims, material, bevel=0.0, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=2, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, material)
    if bevel:
        mod = obj.modifiers.new("Rounded bodywork", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return obj


def cyl(name, loc, radius, depth, material, rot=(0.0, 0.0, 0.0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    return obj


def build() -> None:
    clear_scene()

    gray = mat("Tundra metallic gray", (0.27, 0.29, 0.29, 1.0), metallic=0.62, roughness=0.28)
    dark_gray = mat("Lower charcoal trim", (0.13, 0.14, 0.15, 1.0), metallic=0.25, roughness=0.4)
    chrome = mat("Chrome", (0.72, 0.76, 0.8, 1.0), metallic=0.95, roughness=0.12)
    glass = mat("Tinted glass", (0.035, 0.07, 0.085, 1.0), metallic=0.1, roughness=0.16)
    tire = mat("Tire rubber", (0.018, 0.018, 0.02, 1.0), roughness=0.82)
    rim = mat("Factory alloy wheel", (0.5, 0.53, 0.56, 1.0), metallic=0.88, roughness=0.18)
    headlamp = mat("Headlamp lens", (0.78, 0.86, 0.82, 1.0), metallic=0.08, roughness=0.16, emission=(0.16, 0.18, 0.15, 1.0), strength=0.2)
    amber = mat("Amber turn signal", (1.0, 0.36, 0.04, 1.0), metallic=0.05, roughness=0.25)
    red = mat("Tail lamp red", (0.55, 0.02, 0.02, 1.0), metallic=0.05, roughness=0.22, emission=(0.08, 0.0, 0.0, 1.0), strength=0.4)
    black = mat("Black trim", (0.012, 0.015, 0.02, 1.0), roughness=0.6)
    interior = mat("Gray cloth interior", (0.26, 0.27, 0.27, 1.0), roughness=0.86)

    # Overall proportions based on the user's current first-generation Toyota Tundra Double Cab work truck.
    # X = front/rear, Y = left/right, Z = height.
    box("FRAME", (0.05, 0, 0.62), (5.55, 1.58, 0.22), dark_gray, bevel=0.04)
    box("LOWER_BODY", (-0.10, 0, 1.00), (5.70, 1.91, 0.72), gray, bevel=0.11)

    # Front clip and hood, with the rounded/sloping first-gen Tundra silhouette.
    box("FRONT_BUMPER", (-2.82, 0, 0.86), (0.34, 1.88, 0.42), chrome, bevel=0.09)
    box("FRONT_LOWER_VALANCE", (-2.98, 0, 0.67), (0.23, 1.72, 0.26), dark_gray, bevel=0.07)
    box("HOOD", (-2.03, 0, 1.58), (1.45, 1.78, 0.27), gray, bevel=0.10, rot=(0, math.radians(-3), 0))
    box("FRONT_FASCIA", (-2.69, 0, 1.32), (0.34, 1.82, 0.62), gray, bevel=0.10)
    box("CHROME_GRILLE", (-2.88, 0, 1.42), (0.12, 1.12, 0.31), chrome, bevel=0.05)
    box("GRILLE_CENTER", (-2.96, 0, 1.42), (0.05, 0.72, 0.13), black, bevel=0.03)
    cyl("TOYOTA_GRILLE_BADGE", (-3.01, 0, 1.43), 0.10, 0.04, chrome, rot=(0, math.radians(90), 0), vertices=32)

    for y in (-0.67, 0.67):
        box(f"HEADLIGHT_{y}", (-2.85, y, 1.50), (0.16, 0.46, 0.34), headlamp, bevel=0.05)
        box(f"TURN_SIGNAL_{y}", (-2.86, y * 1.08, 1.51), (0.17, 0.17, 0.31), amber, bevel=0.04)
        cyl(f"FOG_LIGHT_{y}", (-3.00, y * 1.04, 0.81), 0.13, 0.05, headlamp, rot=(0, math.radians(90), 0))

    # Double Cab cabin with four doors and tall greenhouse.
    box("CAB_MAIN", (-0.65, 0, 1.75), (3.08, 1.83, 1.37), gray, bevel=0.16)
    box("CAB_ROOF", (-0.55, 0, 2.42), (2.70, 1.76, 0.16), gray, bevel=0.10)
    box("WINDSHIELD", (-1.91, 0, 2.05), (0.10, 1.60, 0.74), glass, bevel=0.04, rot=(0, math.radians(-18), 0))
    box("REAR_GLASS", (0.79, 0, 2.06), (0.08, 1.47, 0.72), glass, bevel=0.04, rot=(0, math.radians(7), 0))

    # Side windows, door seams, handles and mirrors.
    for side in (-1, 1):
        y = side * 0.925
        box(f"FRONT_SIDE_GLASS_{side}", (-1.08, y, 2.09), (0.94, 0.07, 0.58), glass, bevel=0.04)
        box(f"REAR_SIDE_GLASS_{side}", (0.06, y, 2.09), (0.89, 0.07, 0.58), glass, bevel=0.04)
        box(f"B_PILLAR_{side}", (-0.49, y, 2.08), (0.12, 0.08, 0.65), black, bevel=0.02)
        box(f"FRONT_DOOR_SEAM_{side}", (-1.02, y * 1.004, 1.43), (0.04, 0.03, 0.88), dark_gray)
        box(f"REAR_DOOR_SEAM_{side}", (0.15, y * 1.004, 1.43), (0.04, 0.03, 0.88), dark_gray)
        box(f"FRONT_HANDLE_{side}", (-0.78, y * 1.02, 1.70), (0.24, 0.06, 0.08), chrome, bevel=0.03)
        box(f"REAR_HANDLE_{side}", (0.30, y * 1.02, 1.70), (0.24, 0.06, 0.08), chrome, bevel=0.03)
        box(f"MIRROR_ARM_{side}", (-1.66, y * 1.05, 1.94), (0.23, 0.10, 0.10), dark_gray, bevel=0.03)
        box(f"CHROME_MIRROR_{side}", (-1.72, y * 1.11, 2.02), (0.30, 0.16, 0.24), chrome, bevel=0.08)
        box(f"SIDE_STEP_{side}", (-0.34, y * 1.06, 0.68), (2.70, 0.17, 0.16), chrome, bevel=0.06)
        box(f"STEP_PAD_FRONT_{side}", (-0.98, y * 1.09, 0.73), (0.72, 0.12, 0.05), black, bevel=0.02)
        box(f"STEP_PAD_REAR_{side}", (0.28, y * 1.09, 0.73), (0.72, 0.12, 0.05), black, bevel=0.02)

    # Bed and rear, matching the standard open pickup bed in the reference photos.
    box("BED_FLOOR", (1.85, 0, 1.12), (2.38, 1.66, 0.22), dark_gray, bevel=0.04)
    for side in (-1, 1):
        box(f"BED_SIDE_{side}", (1.87, side * 0.87, 1.50), (2.42, 0.18, 0.83), gray, bevel=0.08)
        box(f"BED_RAIL_{side}", (1.87, side * 0.88, 1.92), (2.40, 0.16, 0.12), gray, bevel=0.05)
    box("FRONT_BED_WALL", (0.74, 0, 1.54), (0.18, 1.73, 0.84), gray, bevel=0.06)
    box("TAILGATE", (3.00, 0, 1.48), (0.18, 1.72, 0.78), gray, bevel=0.06)
    box("TAILGATE_HANDLE", (3.10, 0, 1.68), (0.08, 0.34, 0.12), black, bevel=0.03)
    box("REAR_BUMPER", (3.14, 0, 0.86), (0.32, 1.84, 0.38), chrome, bevel=0.08)
    box("HITCH_RECEIVER", (3.30, 0, 0.53), (0.32, 0.30, 0.22), black, bevel=0.03)
    for side in (-1, 1):
        box(f"TAIL_LIGHT_{side}", (3.09, side * 0.77, 1.53), (0.16, 0.20, 0.62), red, bevel=0.04)

    # Wheel arches are suggested by trim blocks; wheels use more realistic truck proportions.
    wheel_x = (-2.00, 2.12)
    for x in wheel_x:
        for side in (-1, 1):
            y = side * 0.99
            cyl(f"TIRE_{x}_{side}", (x, y, 0.62), 0.52, 0.28, tire, rot=(math.radians(90), 0, 0), vertices=64)
            cyl(f"RIM_{x}_{side}", (x, y * 1.005, 0.62), 0.29, 0.30, rim, rot=(math.radians(90), 0, 0), vertices=48)
            cyl(f"HUB_{x}_{side}", (x, y * 1.008, 0.62), 0.09, 0.31, chrome, rot=(math.radians(90), 0, 0), vertices=32)

    # Light interior silhouette so windows read correctly from oblique angles.
    box("FRONT_BENCH_VOLUME", (-1.02, 0, 1.36), (0.72, 1.45, 0.55), interior, bevel=0.12)
    box("REAR_BENCH_VOLUME", (0.18, 0, 1.36), (0.78, 1.48, 0.54), interior, bevel=0.12)
    cyl("STEERING_WHEEL", (-1.52, -0.45, 1.75), 0.22, 0.06, black, rot=(math.radians(90), 0, 0), vertices=40)
    box("DASH", (-1.45, 0, 1.72), (0.48, 1.45, 0.32), dark_gray, bevel=0.06)

    # Small trim cues from the real truck, without pretending to be a photogrammetry scan.
    box("TUNDRA_SIDE_TRIM_LEFT", (-0.12, -0.99, 1.18), (2.78, 0.05, 0.08), dark_gray, bevel=0.02)
    box("TUNDRA_SIDE_TRIM_RIGHT", (-0.12, 0.99, 1.18), (2.78, 0.05, 0.08), dark_gray, bevel=0.02)
    box("V8_TAILGATE_BADGE", (3.10, 0.62, 1.30), (0.06, 0.20, 0.09), chrome, bevel=0.02)

    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
    )
    print("Built photo-referenced Toyota Tundra work-truck GLB.")


if __name__ == "__main__":
    build()
