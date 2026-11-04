import * as THREE from 'three';

/** Screen-door cutaway retains correct depth and shadows while revealing the walking actor. */
export class Occlusion {
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private copies = new Set<THREE.Material>();
  private entries: { group: THREE.Group; visibility: { value: number }; target: number }[];
  private ray = new THREE.Raycaster();
  private frame = 0;
  constructor(groups: THREE.Group[]) {
    this.entries = groups.map(group => {
      const visibility = { value: 1 }, clones = new Map<THREE.Material, THREE.Material>();
      group.traverse(obj => {
        if (!(obj instanceof THREE.Mesh)) return;
        const prepare = (source: THREE.Material) => {
          let copy = clones.get(source); if (copy) return copy;
          copy = source.clone(); this.copies.add(copy); copy.onBeforeCompile = shader => {
            shader.uniforms.uVisibility = visibility;
            shader.vertexShader = 'varying float vCutawayHeight;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
              vec4 cutawayWorld=vec4(transformed,1.);
              #ifdef USE_INSTANCING
                cutawayWorld=instanceMatrix*cutawayWorld;
              #endif
              vCutawayHeight=(modelMatrix*cutawayWorld).y;`);
            shader.fragmentShader = 'uniform float uVisibility; varying float vCutawayHeight;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
              vec2 cell=floor(gl_FragCoord.xy/1.5);
              float threshold=fract(52.9829189*fract(dot(cell,vec2(.06711056,.00583715))));
              if(vCutawayHeight>.65 && threshold>uVisibility) discard;`);
          };
          copy.customProgramCacheKey = () => 'hamilton-cutaway-v2'; clones.set(source, copy); return copy;
        };
        this.originals.set(obj, obj.material);
        obj.material = Array.isArray(obj.material) ? obj.material.map(prepare) : prepare(obj.material);
      });
      return { group, visibility, target: 1 };
    });
  }
  update(camera: THREE.Camera, target: THREE.Vector3, dt: number, instant: boolean) {
    if (this.frame++ % 6 === 0) {
      for (const entry of this.entries) entry.target = 1;
      // Door lintels can hide the torso while leaving the head visible. Sample the
      // full actor height so narrow interior structures also reveal the walker.
      for (const height of [.2, 1, 1.65]) {
        const destination = target.clone().add(new THREE.Vector3(0, height, 0));
        this.ray.set(camera.position, destination.clone().sub(camera.position).normalize());
        this.ray.far = camera.position.distanceTo(destination) - .7;
        for (const entry of this.entries) if (entry.target === 1 && this.ray.intersectObject(entry.group, true).length) entry.target = .18;
      }
    }
    for (const entry of this.entries) entry.visibility.value = THREE.MathUtils.lerp(entry.visibility.value, entry.target, instant ? 1 : 1 - Math.exp(-dt * 9));
  }
  get count() { return this.entries.filter(entry => entry.visibility.value < .9).length; }
  dispose() {
    this.originals.forEach((material, mesh) => { mesh.material = material; });
    this.copies.forEach(material => material.dispose()); this.copies.clear(); this.originals.clear(); this.entries = [];
  }
}
