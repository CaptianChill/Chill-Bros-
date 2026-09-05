from __future__ import annotations

from pathlib import Path
import math
import random

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


def add_text(name: str, body: str, loc, material, side: int, scale=0.46, shadow=False):
    # Blender text lies in XY and faces +Z. Rotate it to face each truck side.
    rot_x = math.radians(-90 * side)
    bpy.ops.object.text_add(location=loc, rotation=(rot_x, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.extrude = 0.035 if not shadow else 0.018
    obj.data.bevel_depth = 0.012 if not shadow else 0.006
    obj.data.bevel_resolution = 2
    obj.scale = (scale, scale, scale)
    assign(obj, material)
    bpy.ops.object.convert(target="MESH")
    return obj


def add_multispoke_wheel(name: str, x: float, y: float, z: float, side: int, tire_mat, rim_mat, hub_mat):
    # Large lifted-show-truck wheel proportions based on the approved render.
    tire_radius = 0.69
    rim_radius = 0.49
    wheel_depth = 0.36
    rim_depth = 0.38

    cyl(f"{name}_TIRE", (x, y, z), tire_radius, wheel_depth, tire_mat, rot=(math.radians(90), 0, 0), vertices=72)
    cyl(f"{name}_RIM_BARREL", (x, y * 1.004, z), rim_radius, rim_depth, rim_mat, rot=(math.radians(90), 0, 0), vertices=72)
    cyl(f"{name}_HUB", (x, y * 1.007, z), 0.12, 0.40, hub_mat, rot=(math.radians(90), 0, 0), vertices=36)

    # Deep multi-spoke look. Each spoke is a glossy-black bar in the XZ wheel plane.
    for i in range(18):
        angle = (math.tau / 18) * i
        spoke_len = 0.34
        sx = x + math.cos(angle) * 0.20
        sz = z + math.sin(angle) * 0.20
        box(
            f"{name}_SPOKE_{i}",
            (sx, y * 1.012, sz),
            (spoke_len, 0.055, 0.045),
            rim_mat,
            bevel=0.012,
            rot=(0.0, angle, 0.0),
        )


def add_wrap_details(matte_black, star_white, star_blue, frost, ice_blue, side: int):
    rng = random.Random(9200 + side)
    y = side * 0.972

    # Star field across the doors and bed. Tiny emissive flakes read as the approved space-sky wrap.
    for i in range(54):
        x = rng.uniform(-2.55, 2.95)
        if x < 0.82:
            z = rng.uniform(1.12, 2.28)
        else:
            z = rng.uniform(1.16, 1.88)
        size = rng.uniform(0.018, 0.045)
        material = star_blue if i % 4 == 0 else star_white
        box(f"STAR_{side}_{i}", (x, y, z), (size * 1.8, 0.025, size), material, bevel=0.006)

    # Shooting stars concentrated on the upper half.
    for i, x in enumerate((-1.65, -0.75, 0.32, 1.45, 2.25)):
        z = 2.02 if x < 0.8 else 1.76
        box(
            f"SHOOTING_STAR_{side}_{i}",
            (x, y * 1.008, z),
            (0.38, 0.022, 0.035),
            star_blue,
            bevel=0.01,
            rot=(0.0, math.radians(-18), 0.0),
        )
        box(f"SHOOTING_HEAD_{side}_{i}", (x - 0.20, y * 1.009, z + 0.06), (0.06, 0.024, 0.06), star_white, bevel=0.01)

    # Frost/snowstorm begins lightly at the front and progressively builds toward the rear.
    for band in range(13):
        x = -2.35 + band * 0.42
        intensity = (band + 1) / 13.0
        pieces = 1 + int(intensity * 5)
        for piece in range(pieces):
            px = x + rng.uniform(-0.16, 0.16)
            pz = 1.05 + rng.uniform(0.0, 0.46 + 0.28 * intensity)
            width = rng.uniform(0.18, 0.48) * (0.6 + intensity)
            height = rng.uniform(0.035, 0.09) * (0.7 + intensity)
            material = ice_blue if piece % 3 == 0 else frost
            box(
                f"FROST_{side}_{band}_{piece}",
                (px, y * 1.012, pz),
                (width, 0.026, height),
                material,
                bevel=0.012,
                rot=(0.0, math.radians(rng.uniform(-20, 20)), 0.0),
            )

    # Dense rear snow plume. This deliberately grows over the bed instead of being uniform.
    for i in range(18):
        x = rng.uniform(1.25, 3.05)
        z = rng.uniform(1.04, 1.78)
        width = rng.uniform(0.18, 0.55)
        box(
            f"REAR_SNOW_{side}_{i}",
            (x, y * 1.015, z),
            (width, 0.030, rng.uniform(0.04, 0.11)),
            frost if i % 2 else ice_blue,
            bevel=0.012,
            rot=(0.0, math.radians(rng.uniform(-28, 28)), 0.0),
        )


def build() -> None:
    clear_scene()

    # Final approved configuration: matte-black cosmic Chill Bros wrap, blacked-out accessories,
    # lifted stance, large glossy-black multi-spoke wheels, blue/white lighting package.
    matte_black = mat("Flat black galaxy wrap", (0.012, 0.015, 0.022, 1.0), metallic=0.12, roughness=0.50)
    gloss_black = mat("Gloss black accessories", (0.006, 0.007, 0.010, 1.0), metallic=0.55, roughness=0.12)
    glass = mat("Deep tinted glass", (0.012, 0.025, 0.038, 1.0), metallic=0.08, roughness=0.12)
    tire = mat("Off-road tire rubber", (0.012, 0.012, 0.015, 1.0), roughness=0.90)
    rim = mat("Glossy black show rim", (0.006, 0.006, 0.009, 1.0), metallic=0.90, roughness=0.08)
    ice = mat("Ice blue wrap", (0.12, 0.62, 1.0, 1.0), metallic=0.18, roughness=0.24, emission=(0.04, 0.20, 0.62, 1.0), strength=0.65)
    frost = mat("Frost white", (0.82, 0.94, 1.0, 1.0), metallic=0.04, roughness=0.35, emission=(0.14, 0.24, 0.32, 1.0), strength=0.38)
    star_white = mat("Star white", (0.92, 0.98, 1.0, 1.0), metallic=0.0, roughness=0.22, emission=(0.55, 0.72, 1.0, 1.0), strength=2.8)
    star_blue = mat("Meteor blue", (0.08, 0.48, 1.0, 1.0), metallic=0.08, roughness=0.18, emission=(0.04, 0.28, 1.0, 1.0), strength=3.2)
    headlamp = mat("Ice white LED", (0.90, 0.97, 1.0, 1.0), metallic=0.04, roughness=0.12, emission=(0.55, 0.80, 1.0, 1.0), strength=3.6)
    red = mat("Tail lamp red", (0.50, 0.02, 0.02, 1.0), metallic=0.05, roughness=0.22, emission=(0.18, 0.0, 0.0, 1.0), strength=0.8)
    interior = mat("Dark interior", (0.045, 0.047, 0.052, 1.0), roughness=0.86)

    # Base first-generation Tundra Double Cab proportions from the user's all-angle reference set.
    box("FRAME", (0.05, 0, 0.62), (5.55, 1.58, 0.22), gloss_black, bevel=0.04)
    box("LOWER_BODY", (-0.10, 0, 1.00), (5.70, 1.91, 0.72), matte_black, bevel=0.11)
    box("FRONT_BUMPER", (-2.82, 0, 0.86), (0.34, 1.88, 0.42), matte_black, bevel=0.09)
    box("FRONT_LOWER_VALANCE", (-2.98, 0, 0.67), (0.23, 1.72, 0.26), gloss_black, bevel=0.07)
    box("HOOD", (-2.03, 0, 1.58), (1.45, 1.78, 0.27), matte_black, bevel=0.10, rot=(0, math.radians(-3), 0))
    box("FRONT_FASCIA", (-2.69, 0, 1.32), (0.34, 1.82, 0.62), matte_black, bevel=0.10)
    box("BLACK_GRILLE", (-2.88, 0, 1.42), (0.12, 1.12, 0.31), gloss_black, bevel=0.05)
    box("GRILLE_CENTER", (-2.96, 0, 1.42), (0.05, 0.72, 0.13), gloss_black, bevel=0.03)
    cyl("BLACK_TOYOTA_BADGE", (-3.01, 0, 1.43), 0.10, 0.04, gloss_black, rot=(0, math.radians(90), 0), vertices=32)

    for y in (-0.67, 0.67):
        box(f"HEADLIGHT_{y}", (-2.85, y, 1.50), (0.16, 0.46, 0.34), headlamp, bevel=0.05)
        cyl(f"FOG_LIGHT_{y}", (-3.00, y * 1.04, 0.81), 0.13, 0.05, headlamp, rot=(0, math.radians(90), 0))

    box("CAB_MAIN", (-0.65, 0, 1.75), (3.08, 1.83, 1.37), matte_black, bevel=0.16)
    box("CAB_ROOF", (-0.55, 0, 2.42), (2.70, 1.76, 0.16), matte_black, bevel=0.10)
    box("WINDSHIELD", (-1.91, 0, 2.05), (0.10, 1.60, 0.74), glass, bevel=0.04, rot=(0, math.radians(-18), 0))
    box("REAR_GLASS", (0.79, 0, 2.06), (0.08, 1.47, 0.72), glass, bevel=0.04, rot=(0, math.radians(7), 0))

    for side in (-1, 1):
        y = side * 0.925
        box(f"FRONT_SIDE_GLASS_{side}", (-1.08, y, 2.09), (0.94, 0.07, 0.58), glass, bevel=0.04)
        box(f"REAR_SIDE_GLASS_{side}", (0.06, y, 2.09), (0.89, 0.07, 0.58), glass, bevel=0.04)
        box(f"B_PILLAR_{side}", (-0.49, y, 2.08), (0.12, 0.08, 0.65), gloss_black, bevel=0.02)
        box(f"FRONT_DOOR_SEAM_{side}", (-1.02, y * 1.004, 1.43), (0.04, 0.03, 0.88), gloss_black)
        box(f"REAR_DOOR_SEAM_{side}", (0.15, y * 1.004, 1.43), (0.04, 0.03, 0.88), gloss_black)
        box(f"FRONT_HANDLE_{side}", (-0.78, y * 1.02, 1.70), (0.24, 0.06, 0.08), gloss_black, bevel=0.03)
        box(f"REAR_HANDLE_{side}", (0.30, y * 1.02, 1.70), (0.24, 0.06, 0.08), gloss_black, bevel=0.03)
        box(f"MIRROR_ARM_{side}", (-1.66, y * 1.05, 1.94), (0.23, 0.10, 0.10), gloss_black, bevel=0.03)
        box(f"BLACK_MIRROR_{side}", (-1.72, y * 1.11, 2.02), (0.30, 0.16, 0.24), gloss_black, bevel=0.08)
        box(f"SIDE_STEP_{side}", (-0.34, y * 1.06, 0.68), (2.70, 0.17, 0.16), gloss_black, bevel=0.06)

    box("BED_FLOOR", (1.85, 0, 1.12), (2.38, 1.66, 0.22), gloss_black, bevel=0.04)
    for side in (-1, 1):
        box(f"BED_SIDE_{side}", (1.87, side * 0.87, 1.50), (2.42, 0.18, 0.83), matte_black, bevel=0.08)
        box(f"BED_RAIL_{side}", (1.87, side * 0.88, 1.92), (2.40, 0.16, 0.12), matte_black, bevel=0.05)
    box("FRONT_BED_WALL", (0.74, 0, 1.54), (0.18, 1.73, 0.84), matte_black, bevel=0.06)
    box("TAILGATE", (3.00, 0, 1.48), (0.18, 1.72, 0.78), matte_black, bevel=0.06)
    box("TAILGATE_HANDLE", (3.10, 0, 1.68), (0.08, 0.34, 0.12), gloss_black, bevel=0.03)
    box("REAR_BUMPER", (3.14, 0, 0.86), (0.32, 1.84, 0.38), gloss_black, bevel=0.08)
    box("HITCH_RECEIVER", (3.30, 0, 0.53), (0.32, 0.30, 0.22), gloss_black, bevel=0.03)
    for side in (-1, 1):
        box(f"TAIL_LIGHT_{side}", (3.09, side * 0.77, 1.53), (0.16, 0.20, 0.62), red, bevel=0.04)

    # Interior volumes remain dark because the approved exterior has deep tint.
    box("FRONT_BENCH_VOLUME", (-1.02, 0, 1.36), (0.72, 1.45, 0.55), interior, bevel=0.12)
    box("REAR_BENCH_VOLUME", (0.18, 0, 1.36), (0.78, 1.48, 0.54), interior, bevel=0.12)
    cyl("STEERING_WHEEL", (-1.52, -0.45, 1.75), 0.22, 0.06, gloss_black, rot=(math.radians(90), 0, 0), vertices=40)
    box("DASH", (-1.45, 0, 1.72), (0.48, 1.45, 0.32), gloss_black, bevel=0.06)

    # Apply wrap artwork geometry on both sides before lifting the body.
    for side in (-1, 1):
        add_wrap_details(matte_black, star_white, star_blue, frost, ice, side)
        shadow_y = side * 1.000
        text_y = side * 1.028
        add_text(f"CHILL_BROS_SHADOW_{side}", "CHILL\nBROS", (-0.10, shadow_y, 1.62), gloss_black, side, scale=0.44, shadow=True)
        add_text(f"CHILL_BROS_TEXT_{side}", "CHILL\nBROS", (-0.10, text_y, 1.64), ice, side, scale=0.42)

    # Galaxy accents over hood and roof so the wrap reads correctly from the 3/4 app view.
    rng_top = random.Random(1138)
    for i in range(22):
        x = rng_top.uniform(-2.55, 0.65)
        y = rng_top.uniform(-0.72, 0.72)
        z = 1.74 if x < -1.3 else 2.52
        box(f"TOP_STAR_{i}", (x, y, z), (0.035, 0.035, 0.018), star_white if i % 3 else star_blue, bevel=0.006)

    # Lift all body/wrap/interior pieces as one assembly, preserving the approved truck proportions.
    lift = 0.52
    for obj in list(bpy.context.scene.objects):
        obj.location.z += lift

    # Suspension and axle details become visible at this lift height.
    for axle_x in (-2.00, 2.12):
        cyl(f"AXLE_{axle_x}", (axle_x, 0, 0.62), 0.10, 1.86, gloss_black, rot=(math.radians(90), 0, 0), vertices=32)
        for side in (-1, 1):
            y = side * 0.78
            cyl(f"SHOCK_{axle_x}_{side}", (axle_x, y, 0.96), 0.065, 0.62, gloss_black, vertices=24)
            cyl(f"ICE_SHOCK_COLLAR_{axle_x}_{side}", (axle_x, y, 1.13), 0.080, 0.18, ice, vertices=24)

    # Exact visual direction from the approved render: oversized glossy-black multi-spoke wheels.
    for x in (-2.00, 2.12):
        for side in (-1, 1):
            add_multispoke_wheel(f"WHEEL_{x}_{side}", x, side * 1.02, 0.68, side, tire, rim, gloss_black)

    # Ice-blue underglow / light package. Emissive strips travel beneath the cab and bed.
    box("UNDERGLOW_CENTER", (0.35, 0, 0.37), (4.85, 1.05, 0.045), star_blue, bevel=0.02)
    for side in (-1, 1):
        box(f"ROCKER_GLOW_{side}", (-0.15, side * 0.80, 0.48), (3.25, 0.05, 0.05), ice, bevel=0.018)

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
    print("Built final lifted Chill Bros cosmic-wrap Toyota Tundra GLB.")


if __name__ == "__main__":
    build()
