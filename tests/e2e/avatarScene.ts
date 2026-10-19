import type { Page } from '@playwright/test';

/** Inspect the real R3F scene in development, without adding a production debug endpoint. */
export async function avatarScene(page: Page) {
  return page.evaluate(async () => {
    const path = '/node_modules/.vite/deps/@react-three_fiber.js'; const { _roots } = await import(path);
    for (const [canvas, root] of _roots) {
      if (!canvas.closest('.hub-canvas, .art-canvas, .editor-3d')) continue;
      const state = root.store.getState(); const names: string[] = []; const geometries = new Set<string>(); const materials = new Set<string>(); let meshes = 0;
      state.scene.traverse((object: { name: string; isMesh?: boolean; geometry?: { uuid: string }; material?: { uuid: string } }) => {
        if (object.name.startsWith('appearance:')) names.push(object.name);
        if (object.isMesh) { meshes++; if (object.geometry) geometries.add(object.geometry.uuid); if (object.material) materials.add(object.material.uuid); }
      });
      return { names, meshes, geometries: geometries.size, materials: materials.size, calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles };
    }
    return null;
  });
}
