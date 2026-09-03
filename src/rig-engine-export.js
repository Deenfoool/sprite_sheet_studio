import { zipSync } from './zip-store.js';

let rigEngineExportInitialized = false;

function initRigEngineExport() {
  if (rigEngineExportInitialized) return true;
  const persistence = globalThis.__SSSRigPersistence;
  const rigActions = document.querySelector('.rig-top-actions');
  if (!persistence?.serializeExtras || !(rigActions instanceof HTMLElement)) return false;
  rigEngineExportInitialized = true;

  const encoder = new TextEncoder();

  function text(value) { return encoder.encode(String(value)); }

  function safeName(value, fallback = 'asset') {
    return String(value || fallback).trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback;
  }

  function dataUrlBytes(dataUrl) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ''));
    if (!match) throw new Error('Invalid embedded rig image.');
    if (match[2]) {
      const binary = atob(match[3]);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
      return out;
    }
    return text(decodeURIComponent(match[3]));
  }

  function buildRuntimeRig(extras, files) {
    const source = extras.rigging || { version: 1, canvas: { width: 900, height: 600 }, bones: [], parts: [] };
    const runtime = JSON.parse(JSON.stringify(source));
    runtime.parts = (source.parts || []).map((part, index) => {
      const extension = /^data:image\/webp/i.test(part.image || '') ? 'webp' : 'png';
      const filename = `${String(index + 1).padStart(2, '0')}-${safeName(part.name, 'part')}-${safeName(part.id, 'id')}.${extension}`;
      if (part.image) files[`SpriteSheetStudioRig/parts/${filename}`] = dataUrlBytes(part.image);
      return { ...part, image: part.image ? `../parts/${filename}` : null, assetFile: part.image ? filename : null };
    });
    return runtime;
  }

  function unityPayload(runtimeRig, skeletal, ik, mesh) {
    const animations = Object.entries(skeletal?.animations || {}).map(([name, animation]) => ({
      name,
      fps: Number(animation.fps) || 12,
      length: Number(animation.length) || 24,
      loop: animation.loop !== false,
      interpolation: animation.interpolation || 'linear',
      curve: Array.isArray(animation.curve) ? animation.curve : [0.42, 0, 0.58, 1],
      keyframes: Object.entries(animation.keyframes || {}).map(([frame, pose]) => ({
        frame: Number(frame) || 0,
        bones: Object.entries(pose?.bones || {}).map(([id, value]) => ({ id, ...value })),
        parts: Object.entries(pose?.parts || {}).map(([id, value]) => ({ id, ...value }))
      }))
    }));
    return {
      version: 1,
      app: 'Sprite Sheet Studio',
      canvas: runtimeRig.canvas,
      bones: runtimeRig.bones || [],
      parts: (runtimeRig.parts || []).map((part) => ({ ...part, assetPath: part.assetFile ? `Assets/SpriteSheetStudioRig/parts/${part.assetFile}` : '' })),
      animations,
      ikChains: ik?.chains || [],
      mesh: mesh || null
    };
  }

  const godotImporter = `@tool
extends EditorScript

const PACKAGE_ROOT := "res://SpriteSheetStudioRig"
const RIG_PATH := PACKAGE_ROOT + "/rig/rig-runtime.json"
const OUTPUT_SCENE := PACKAGE_ROOT + "/sprite_sheet_studio_rig.tscn"

func _run() -> void:
    if not FileAccess.file_exists(RIG_PATH):
        push_error("Sprite Sheet Studio: missing " + RIG_PATH)
        return
    var parsed = JSON.parse_string(FileAccess.get_file_as_string(RIG_PATH))
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("Sprite Sheet Studio: invalid rig JSON")
        return

    var root := Node2D.new()
    root.name = "SpriteSheetStudioRig"
    var skeleton := Skeleton2D.new()
    skeleton.name = "Skeleton2D"
    root.add_child(skeleton)
    skeleton.owner = root

    var bone_nodes := {}
    var bone_data := {}
    for raw in parsed.get("bones", []):
        bone_data[raw.get("id", "")] = raw

    var pending: Array = parsed.get("bones", []).duplicate(true)
    var guard := 0
    while not pending.is_empty() and guard < 2048:
        guard += 1
        var raw = pending.pop_front()
        var id = raw.get("id", "")
        var parent_id = raw.get("parentId", null)
        if parent_id != null and not bone_nodes.has(parent_id):
            pending.push_back(raw)
            continue
        var bone := Bone2D.new()
        bone.name = raw.get("name", id)
        bone.length = float(raw.get("length", 80.0))
        bone.rotation_degrees = float(raw.get("rotation", 0.0))
        if parent_id == null:
            bone.position = Vector2(float(raw.get("x", 0.0)), float(raw.get("y", 0.0)))
            skeleton.add_child(bone)
        else:
            var parent: Bone2D = bone_nodes[parent_id]
            var parent_raw: Dictionary = bone_data[parent_id]
            bone.position = Vector2(float(parent_raw.get("length", 0.0)) + float(raw.get("x", 0.0)), float(raw.get("y", 0.0)))
            parent.add_child(bone)
        bone.owner = root
        bone_nodes[id] = bone

    for raw in parsed.get("parts", []):
        var sprite := Sprite2D.new()
        sprite.name = raw.get("name", "part")
        var parent_id = raw.get("boneId", "root")
        var parent: Node = bone_nodes.get(parent_id, skeleton)
        parent.add_child(sprite)
        sprite.owner = root
        sprite.position = Vector2(float(raw.get("x", 0.0)), float(raw.get("y", 0.0)))
        sprite.rotation_degrees = float(raw.get("rotation", 0.0))
        sprite.scale = Vector2(float(raw.get("scaleX", 1.0)), float(raw.get("scaleY", 1.0)))
        sprite.modulate.a = float(raw.get("opacity", 1.0))
        sprite.visible = raw.get("visible", true)
        var asset_file = raw.get("assetFile", "")
        if asset_file != "":
            sprite.texture = load(PACKAGE_ROOT + "/parts/" + asset_file)

    var packed := PackedScene.new()
    var result := packed.pack(root)
    if result != OK:
        push_error("Sprite Sheet Studio: could not pack scene")
        return
    ResourceSaver.save(packed, OUTPUT_SCENE)
    print("Sprite Sheet Studio: generated " + OUTPUT_SCENE)
`;

  const unityImporter = `// Generated helper for Sprite Sheet Studio rig packages.
// Copy the SpriteSheetStudioRig folder under Assets/, then run:
// Tools > Sprite Sheet Studio > Import Rig Package
using System;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class SpriteSheetStudioRigImporter
{
    const string Root = "Assets/SpriteSheetStudioRig";
    const string JsonPath = Root + "/unity/rig-unity.json";

    [Serializable] public class CanvasData { public float width; public float height; }
    [Serializable] public class BoneData { public string id; public string name; public string parentId; public float x; public float y; public float rotation; public float length; public bool visible = true; }
    [Serializable] public class PartData { public string id; public string name; public string boneId; public float x; public float y; public float pivotX; public float pivotY; public float rotation; public float scaleX = 1; public float scaleY = 1; public int z; public float opacity = 1; public bool visible = true; public string assetPath; }
    [Serializable] public class RigData { public int version; public CanvasData canvas; public BoneData[] bones; public PartData[] parts; }

    [MenuItem("Tools/Sprite Sheet Studio/Import Rig Package")]
    public static void Import()
    {
        if (!File.Exists(JsonPath)) { Debug.LogError("Missing " + JsonPath); return; }
        var data = JsonUtility.FromJson<RigData>(File.ReadAllText(JsonPath));
        if (data == null || data.bones == null) { Debug.LogError("Invalid Sprite Sheet Studio rig JSON"); return; }

        var root = new GameObject("SpriteSheetStudioRig");
        var byId = new System.Collections.Generic.Dictionary<string, GameObject>();
        var byBone = new System.Collections.Generic.Dictionary<string, BoneData>();
        foreach (var bone in data.bones) byBone[bone.id] = bone;

        var remaining = new System.Collections.Generic.List<BoneData>(data.bones);
        var guard = 0;
        while (remaining.Count > 0 && guard++ < 4096)
        {
            var progressed = false;
            for (var i = remaining.Count - 1; i >= 0; --i)
            {
                var bone = remaining[i];
                if (!string.IsNullOrEmpty(bone.parentId) && !byId.ContainsKey(bone.parentId)) continue;
                var go = new GameObject(string.IsNullOrEmpty(bone.name) ? bone.id : bone.name);
                if (string.IsNullOrEmpty(bone.parentId))
                {
                    go.transform.SetParent(root.transform, false);
                    go.transform.localPosition = new Vector3(bone.x, -bone.y, 0);
                }
                else
                {
                    var parent = byId[bone.parentId];
                    var parentData = byBone[bone.parentId];
                    go.transform.SetParent(parent.transform, false);
                    go.transform.localPosition = new Vector3(parentData.length + bone.x, -bone.y, 0);
                }
                go.transform.localRotation = Quaternion.Euler(0, 0, -bone.rotation);
                go.SetActive(bone.visible);
                byId[bone.id] = go;
                remaining.RemoveAt(i);
                progressed = true;
            }
            if (!progressed) break;
        }

        if (data.parts != null)
        {
            foreach (var part in data.parts)
            {
                var go = new GameObject(string.IsNullOrEmpty(part.name) ? part.id : part.name);
                var parent = byId.ContainsKey(part.boneId) ? byId[part.boneId].transform : root.transform;
                go.transform.SetParent(parent, false);
                go.transform.localPosition = new Vector3(part.x, -part.y, 0);
                go.transform.localRotation = Quaternion.Euler(0, 0, -part.rotation);
                go.transform.localScale = new Vector3(part.scaleX == 0 ? 1 : part.scaleX, part.scaleY == 0 ? 1 : part.scaleY, 1);
                go.SetActive(part.visible);
                var renderer = go.AddComponent<SpriteRenderer>();
                renderer.sortingOrder = part.z;
                renderer.color = new Color(1, 1, 1, Mathf.Clamp01(part.opacity));
                if (!string.IsNullOrEmpty(part.assetPath)) renderer.sprite = AssetDatabase.LoadAssetAtPath<Sprite>(part.assetPath);
            }
        }

        Selection.activeGameObject = root;
        Undo.RegisterCreatedObjectUndo(root, "Import Sprite Sheet Studio Rig");
        Debug.Log("Sprite Sheet Studio rig imported. Animation JSON is available under " + Root + "/animations/.");
    }
}
`;

  const packageReadme = `# Sprite Sheet Studio Rig Package

This package was generated entirely in the browser.

## Contents

- \`rig/rig-runtime.json\` — engine-agnostic bone and sprite-part hierarchy.
- \`parts/\` — extracted PNG/WebP body-part textures.
- \`animations/skeletal-animations.json\` — skeletal clips and keyframes.
- \`ik/ik.json\` — IK chains, targets, pole targets, constraints and stretch settings.
- \`mesh/mesh.json\` — mesh topology, bind pose and bone weights.
- \`godot/import_rig.gd\` — Godot 4 EditorScript that builds a Bone2D/Sprite2D scene.
- \`unity/rig-unity.json\` — Unity-friendly array-based rig representation.
- \`unity/Editor/SpriteSheetStudioRigImporter.cs\` — Unity Editor importer helper.

## Godot 4

Copy \`SpriteSheetStudioRig\` into your project, open \`godot/import_rig.gd\` in the Script Editor and run the EditorScript. It creates \`sprite_sheet_studio_rig.tscn\`.

The generated scene is intentionally simple: review pivots and texture import settings before production use. Skeletal animation clips remain available as JSON for a game-specific AnimationPlayer/AnimationLibrary importer.

## Unity

Copy \`SpriteSheetStudioRig\` into \`Assets/\`, let Unity import the textures, then run **Tools → Sprite Sheet Studio → Import Rig Package**.

The helper creates the transform hierarchy and SpriteRenderers. Animation clips, IK and mesh data are kept as JSON so a project can map them to Unity 2D Animation, AnimationClip or a custom runtime without losing source data.
`;

  async function exportPackage(button) {
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Building rig package…';
    try {
      const extras = persistence.serializeExtras();
      const files = {};
      const runtimeRig = buildRuntimeRig(extras, files);
      const unityRig = unityPayload(runtimeRig, extras.skeletal, extras.ik, extras.mesh);
      const manifest = {
        version: 1,
        app: 'Sprite Sheet Studio',
        generatedAt: new Date().toISOString(),
        canvas: runtimeRig.canvas,
        boneCount: runtimeRig.bones?.length || 0,
        partCount: runtimeRig.parts?.length || 0,
        skeletalAnimations: Object.keys(extras.skeletal?.animations || {}),
        ikChains: extras.ik?.chains?.length || 0,
        meshVertices: extras.mesh?.vertices?.length || 0,
        meshTriangles: extras.mesh?.triangles?.length || 0
      };

      files['SpriteSheetStudioRig/manifest.json'] = text(JSON.stringify(manifest, null, 2));
      files['SpriteSheetStudioRig/README.md'] = text(packageReadme);
      files['SpriteSheetStudioRig/rig/rig-runtime.json'] = text(JSON.stringify(runtimeRig, null, 2));
      files['SpriteSheetStudioRig/animations/skeletal-animations.json'] = text(JSON.stringify(extras.skeletal || { animations: {} }, null, 2));
      files['SpriteSheetStudioRig/ik/ik.json'] = text(JSON.stringify(extras.ik || { chains: [] }, null, 2));
      files['SpriteSheetStudioRig/mesh/mesh.json'] = text(JSON.stringify(extras.mesh || null, null, 2));
      files['SpriteSheetStudioRig/godot/import_rig.gd'] = text(godotImporter);
      files['SpriteSheetStudioRig/unity/rig-unity.json'] = text(JSON.stringify(unityRig, null, 2));
      files['SpriteSheetStudioRig/unity/Editor/SpriteSheetStudioRigImporter.cs'] = text(unityImporter);

      const bytes = zipSync(files, { level: 0 });
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'sprite-sheet-studio-rig-package.zip';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      button.innerHTML = original;
      button.disabled = false;
      globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
    }
  }

  const button = document.createElement('button');
  button.className = 'btn green';
  button.id = 'rigPackageExport';
  button.title = 'Export rig, animations, IK, mesh and engine import helpers';
  button.innerHTML = '<i data-lucide="package-open" aria-hidden="true"></i><span>Rig package</span>';
  button.addEventListener('click', () => {
    exportPackage(button).catch((error) => {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Rig package export failed.');
    });
  });
  rigActions.append(button);

  globalThis.__SSSRigEngineExport = { exportPackage: () => exportPackage(button) };
  globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  return true;
}

if (!initRigEngineExport()) {
  const timer = window.setInterval(() => {
    if (!initRigEngineExport()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
