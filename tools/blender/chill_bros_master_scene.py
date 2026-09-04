"""Chill Bros Blender master-scene generator.

Run from Blender's Scripting workspace. The script creates a reusable branded scene
with collections, materials, camera, lights, and a simple neon wordmark block.
It intentionally does not overwrite or save a .blend file automatically.
"""

import math
import bpy

ICE_BLUE = (0.12, 0.78, 1.0, 1.0)
ICE_WHITE = (0.86, 0.98, 1.0, 1.0)
NAVY = (0.004, 0.012, 0.035, 1.0)
CHROME = (0.42, 0.52, 0.62, 1.0)
ROSE_GOLD = (0.72, 0.32, 0.24, 1.0)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    root = bpy.context.scene.collection
    base = bpy.data.collections.get("Collection")
    if base:
        base.name = "CB_MASTER"
    return root


def ensure_collection(name, parent):
    collection = bpy.data.collections.get(name)
    if not collection:
        collection = bpy.data.collections.new(name)
        parent.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def emission_material(name, color, strength=8.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = strength
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return material


def principled_material(name, base_color, metallic=0.0, roughness=0.35):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
    return material


def add_text(text, name, location, size, material, collection):
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.06
    obj.data.bevel_depth = 0.012
    obj.data.bevel_resolution = 5
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_area_light(name, location, energy, size, color, rotation, collection):
    bpy.ops.object.light_add(type="AREA", location=location, rotation=rotation)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color[:3]
    move_to_collection(light, collection)
    return light


def add_camera(collection):
    bpy.ops.object.camera_add(location=(0.0, -9.5, 1.1), rotation=(math.radians(82), 0.0, 0.0))
    camera = bpy.context.object
    camera.name = "CB_CAMERA_HERO"
    camera.data.lens = 58
    move_to_collection(camera, collection)
    bpy.context.scene.camera = camera
    return camera


def build_master_scene():
    root = reset_scene()
    brand = ensure_collection("CB_BRAND", root)
    equipment = ensure_collection("CB_EQUIPMENT", root)
    lights = ensure_collection("CB_LIGHTS", root)
    cameras = ensure_collection("CB_CAMERAS", root)
    export = ensure_collection("CB_EXPORT", root)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.image_settings.file_format = "PNG"
    scene["chill_bros_pipeline"] = "blend -> glb -> nextjs"
    scene["web_export_root"] = "public/3d"
    scene["asset_scale_rule"] = "1 Blender meter = 1 real-world meter"

    neon = emission_material("CB_Ice_Blue_Neon", ICE_BLUE, 10.0)
    emission_material("CB_Ice_White_Neon", ICE_WHITE, 6.0)
    principled_material("CB_Matte_Navy", NAVY, metallic=0.05, roughness=0.3)
    principled_material("CB_Chrome", CHROME, metallic=0.95, roughness=0.14)
    principled_material("CB_Rose_Gold", ROSE_GOLD, metallic=0.9, roughness=0.18)

    add_text("CHILL BROS", "CB_NEON_WORDMARK", (0.0, 0.0, 1.25), 1.15, neon, brand)
    subtitle = add_text("3D STUDIO", "CB_STUDIO_SUBTITLE", (0.0, 0.0, 0.25), 0.32, neon, brand)
    subtitle.data.extrude = 0.025

    add_area_light(
        "CB_KEY_ICE",
        (-3.0, -4.0, 5.0),
        1100,
        5.0,
        ICE_BLUE,
        (math.radians(28), 0.0, math.radians(-32)),
        lights,
    )
    add_area_light(
        "CB_RIM_WHITE",
        (3.5, 1.0, 4.0),
        850,
        4.0,
        ICE_WHITE,
        (math.radians(-42), 0.0, math.radians(145)),
        lights,
    )
    add_camera(cameras)

    # Keep empty collections so future equipment and export meshes have predictable homes.
    equipment["purpose"] = "Master collection for service-training equipment models"
    export["purpose"] = "Objects approved for GLB export"

    print("Chill Bros master scene created.")
    print("Next: replace the demo wordmark with the approved Chill Bros vector logo, then save as a reusable .blend template.")


if __name__ == "__main__":
    build_master_scene()
