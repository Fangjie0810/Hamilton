import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Read the actual scene depth, including alpha-tested actors, in a single scene pass. */
export class FocusRenderer {
  readonly target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
  readonly shader = new THREE.ShaderMaterial({
    uniforms: { color: { value: this.target.texture }, depth: { value: this.target.depthTexture }, resolution: { value: new THREE.Vector2(1, 1) }, focus: { value: 26 }, near: { value: .1 }, far: { value: 130 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D color; uniform sampler2D depth;
      uniform vec2 resolution; uniform float focus; uniform float near; uniform float far;
      float viewDepth(float d) { return near*far/(far-d*(far-near)); }
      void main(){
        float dist=viewDepth(texture2D(depth,vUv).x);
        float blur=clamp((abs(dist-focus)-3.5)*.26,0.,3.5);
        vec2 d=blur/resolution;
        vec3 c=texture2D(color,vUv).rgb*.28;
        c+=(texture2D(color,vUv+vec2(d.x,0.)).rgb+texture2D(color,vUv-vec2(d.x,0.)).rgb)*.12;
        c+=(texture2D(color,vUv+vec2(0.,d.y)).rgb+texture2D(color,vUv-vec2(0.,d.y)).rgb)*.12;
        c+=(texture2D(color,vUv+d).rgb+texture2D(color,vUv-d).rgb+texture2D(color,vUv+vec2(d.x,-d.y)).rgb+texture2D(color,vUv+vec2(-d.x,d.y)).rgb)*.06;
        float vignette=1.-smoothstep(.3,.78,distance(vUv,vec2(.5)))*.19;
        c*=vec3(1.035,1.01,.97)*vignette;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  private quad = new FullScreenQuad(this.shader);
  resize(width: number, height: number) { this.target.setSize(width, height); this.shader.uniforms.resolution.value.set(width, height); }
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus: THREE.Vector3) {
    this.shader.uniforms.focus.value = -focus.clone().applyMatrix4(camera.matrixWorldInverse).z;
    this.shader.uniforms.near.value = camera.near; this.shader.uniforms.far.value = camera.far;
    renderer.setRenderTarget(this.target); renderer.render(scene, camera);
    renderer.setRenderTarget(null); this.quad.render(renderer);
  }
  dispose() { this.target.dispose(); this.shader.dispose(); this.quad.dispose(); }
}
