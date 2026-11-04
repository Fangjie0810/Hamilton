import * as THREE from 'three';

/** The prologue's landward fog stays fixed in the world even when the camera orbits.
 * Apply after Occlusion has prepared its materials so both shader effects survive.
 * Each chapter owns a fresh world, so leaving/restarting Opening also owns the fog lifecycle.
 */
export function applyHarborMist(root: THREE.Group) {
  const prepared = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      // Water uses its own shader and lies entirely seaward of the fog bank.
      if (material instanceof THREE.ShaderMaterial || prepared.has(material)) continue;
      prepared.add(material);
      const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer);
        shader.vertexShader = 'varying vec3 vHarborPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
          vec4 harborPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            harborPosition = instanceMatrix * harborPosition;
          #endif
          vHarborPosition = (modelMatrix * harborPosition).xyz;
          #include <project_vertex>`);
        shader.fragmentShader = 'varying vec3 vHarborPosition;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
          #include <fog_fragment>
          #ifdef USE_FOG
            float bankEdge = vHarborPosition.x
              + sin(vHarborPosition.z * .24) * .65
              + sin(vHarborPosition.y * .38 + vHarborPosition.z * .12) * .45;
            float harborFog = 1.0 - smoothstep(4.0, 13.0, bankEdge);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, harborFog);
          #endif`);
      };
      material.customProgramCacheKey = () => `${key}:harbor-mist-v1`;
      material.needsUpdate = true;
    }
  });
  root.userData.harborMist = true;
}
