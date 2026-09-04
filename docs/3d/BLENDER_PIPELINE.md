# Chill Bros 3D Studio / Blender Pipeline

## Purpose

This pipeline turns Blender into a repeatable production tool for the Chill Bros operational software, the Chill Bro Bible, customer proposals, advertising, fleet visualization, and technician training.

The rule is simple:

`Blender master (.blend) -> optimized web model (.glb) -> Chill Bros app`

The `.blend` file is the editable source of truth. The `.glb` file is the lightweight delivery asset used by the web/mobile application.

## Phase 1: Brand master scene

Build and approve one reusable Chill Bros scene containing:

- Approved Chill Bros logo geometry
- Ice-blue neon material
- Matte navy material
- Chrome / white-metal material
- Rose-gold material
- Transparent-background render setup
- Hero camera and product camera
- Ice-blue key and rim lighting
- 1920x1080 and square social render presets

Starter automation: `tools/blender/chill_bros_master_scene.py`

Initial outputs:

- Transparent Chill Bros hero PNG
- Square social/app render
- Short looping brand animation
- `public/3d/brand/chill-bros-neon-logo.glb`

## Phase 2: Equipment training library

Build equipment as component-addressable training models. Components must be separate, clearly named objects rather than one fused mesh.

Recommended naming pattern:

- `COMP_CONTACTOR`
- `COMP_RUN_CAPACITOR`
- `COMP_COMPRESSOR`
- `COMP_CONDENSER_FAN`
- `COMP_TRANSFORMER`
- `COMP_CONTROL_BOARD`
- `COMP_TXV`
- `COMP_PRESSURE_SWITCH_HIGH`
- `COMP_PRESSURE_SWITCH_LOW`
- `COMP_EVAP_FAN`
- `COMP_GAS_VALVE`
- `COMP_IGNITER`
- `COMP_THERMOSTAT`

This naming convention allows the app to later select, highlight, hide, animate, or attach Chill Bro Bible diagnostic instructions to individual components.

First equipment targets:

1. Commercial package RTU
2. Reach-in refrigerator / freezer
3. Walk-in refrigeration system
4. Commercial ice machine
5. Commercial fryer
6. Commercial oven / range

## Asset organization

```text
blender/
  brand/
  equipment/
    hvac/
    refrigeration/
    ice-machines/
    cooking/
  vehicles/

public/3d/
  brand/
  equipment/
    hvac/
    refrigeration/
    ice-machines/
    cooking/
  vehicles/
```

Do not commit large working texture caches, simulations, render-frame sequences, or unnecessary Blender backup files to the web application.

## Web/mobile export rules

- Export production models as binary GLB.
- Use meters and keep real-world scale consistent.
- Apply transforms before final export.
- Remove hidden construction geometry.
- Reuse materials where possible.
- Prefer baked textures and simple physically based materials for equipment models.
- Keep branded emission effects deliberate; mobile hardware still has limits, despite everyone's best efforts to pretend phones are render farms.
- Use sensible polygon counts. Training clarity matters more than microscopic screw threads.
- Keep component names stable after an asset is integrated into software.

## Software integration path

### Stage A
Manager-only `/3d-studio` route tracks the asset library and production status.

### Stage B
Add a mobile-optimized GLB viewer with orbit, zoom, reset-camera, fullscreen, and component selection.

### Stage C
Connect 3D assets to equipment-registry records by equipment type / manufacturer / model family.

### Stage D
Connect named 3D components to Chill Bro Bible diagnostic records so a technician can tap a component and see:

- What the component does
- Expected voltage / resistance / pressure behavior
- Meter placement / test points
- Common failure symptoms
- Diagnostic sequence
- Safety notes
- Related OEM parts data

### Stage E
Add guided animations for electrical sequence of operation, refrigerant flow, airflow, defrost cycles, ignition sequence, and cooking-equipment operation.

## Production principle

3D should reduce technician confusion or improve sales/communication. Do not add motion simply because Blender makes it possible. A spinning compressor that teaches nothing is just an expensive screensaver.
