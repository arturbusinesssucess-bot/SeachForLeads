import { Color, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, SphereGeometry, Vector2, WebGLRenderer } from "three";
export const backgroundShader = "\n                    uniform float u_time;\n                    uniform vec2 u_resolution;\n                    uniform vec3 u_color1;\n                    uniform vec3 u_color2;\n                    \n                vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }\n                float snoise(vec2 v){\n                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n                    vec2 i  = floor(v + dot(v, C.yy) );\n                    vec2 x0 = v -   i + dot(i, C.xx);\n                    vec2 i1;\n                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n                    vec4 x12 = x0.xyxy + C.xxzz;\n                    x12.xy -= i1;\n                    i = mod(i, 289.0);\n                    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));\n                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);\n                    m = m*m ; m = m*m ;\n                    vec3 x = 2.0 * fract(p * C.www) - 1.0;\n                    vec3 h = abs(x) - 0.5;\n                    vec3 ox = floor(x + 0.5);\n                    vec3 a0 = x - ox;\n                    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );\n                    vec3 g;\n                    g.x  = a0.x  * x0.x  + h.x  * x0.y;\n                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n                    return 130.0 * dot(m, g);\n                }\n            \n                    void main() {\n                        vec2 uv = gl_FragCoord.xy / u_resolution.xy;\n                        uv.x *= u_resolution.x / u_resolution.y;\n\n                        vec3 baseColor = vec3(0.02, 0.02, 0.03);\n                        vec2 st = uv * 0.5;\n                        st += vec2(snoise(st + u_time * 0.04), snoise(st - u_time * 0.04)) * 0.4;\n\n                        float beam = smoothstep(0.2, 0.9, snoise(vec2(st.x + st.y * 2.0 - u_time * 0.1, u_time * 0.03)));\n                        vec3 glow = mix(u_color1, u_color2, snoise(uv * 2.0 + u_time * 0.15) * 0.5 + 0.5);\n\n                        float dist = distance(gl_FragCoord.xy / u_resolution.xy, vec2(0.5));\n                        float vignette = (1.0 - smoothstep(0.1, 1.5, dist));\n                        \n                        vec3 edgeColor = vec3(0.01, 0.01, 0.015);\n                        vec3 colorGlow = mix(baseColor, glow, beam * 0.6);\n\n                        gl_FragColor = vec4(mix(edgeColor, colorGlow, vignette), 1.0);\n                    }\n                ";
export const sphereShader = "\n                    uniform float u_time;\n                    uniform vec2 u_resolution;\n                    uniform vec3 u_color1;\n                    uniform vec3 u_color2;\n                    varying vec3 vNormal;\n                    \n                vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }\n                float snoise(vec2 v){\n                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n                    vec2 i  = floor(v + dot(v, C.yy) );\n                    vec2 x0 = v -   i + dot(i, C.xx);\n                    vec2 i1;\n                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n                    vec4 x12 = x0.xyxy + C.xxzz;\n                    x12.xy -= i1;\n                    i = mod(i, 289.0);\n                    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));\n                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);\n                    m = m*m ; m = m*m ;\n                    vec3 x = 2.0 * fract(p * C.www) - 1.0;\n                    vec3 h = abs(x) - 0.5;\n                    vec3 ox = floor(x + 0.5);\n                    vec3 a0 = x - ox;\n                    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );\n                    vec3 g;\n                    g.x  = a0.x  * x0.x  + h.x  * x0.y;\n                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n                    return 130.0 * dot(m, g);\n                }\n            \n                    void main() {\n                        vec2 uv = gl_FragCoord.xy / u_resolution.xy;\n                        uv += vNormal.xy * 0.2; \n                        uv.x *= u_resolution.x / u_resolution.y;\n\n                        vec3 baseColor = vec3(0.04, 0.04, 0.06);\n                        vec2 st = uv * 0.6;\n                        st += vec2(snoise(st + u_time * 0.06), snoise(st - u_time * 0.06)) * 0.35;\n\n                        float beam = smoothstep(0.1, 0.9, snoise(vec2(st.x + st.y * 1.8 - u_time * 0.12, u_time * 0.02)));\n                        vec3 glow = mix(u_color1, u_color2, snoise(uv * 1.8 + u_time * 0.12) * 0.5 + 0.5);\n\n                        float fresnel = dot(vec3(0.0, 0.0, 1.0), vNormal);\n                        fresnel = clamp(1.0 - fresnel, 0.0, 1.0);\n                        fresnel = pow(fresnel, 2.5);\n\n                        vec3 finalColor = mix(baseColor, glow, clamp((beam * 0.5) + (fresnel * 0.8), 0.0, 1.0));\n                        gl_FragColor = vec4(finalColor, 0.95);\n                    }\n                ";
export const sphereVertex = "\n                    varying vec3 vNormal;\n                    void main() {\n                        vNormal = normalize(normalMatrix * normal);\n                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n                    }\n                ";

const instances = new WeakMap<HTMLElement, { destroy: () => void }>();

export function mountDimensionalField(editor: HTMLElement) {
  if (instances.has(editor)) return instances.get(editor);
  const canvas = editor.querySelector<HTMLCanvasElement>(".search-dimensional-canvas");
  const view = editor.closest<HTMLElement>("[data-view]");
  if (!canvas || !view) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  } catch {
    editor.dataset.fieldState = "fallback";
    return null;
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 12;
  const uniforms = {
    u_time: { value: 0 },
    u_resolution: { value: new Vector2(1, 1) },
    u_color1: { value: new Color(0, 0.8, 0.7) },
    u_color2: { value: new Color(0.4, 0, 0.9) },
  };
  const backgroundGeometry = new PlaneGeometry(2, 2);
  const backgroundMaterial = new ShaderMaterial({ uniforms, vertexShader: "void main(){gl_Position=vec4(position,1.0);}", fragmentShader: backgroundShader, depthWrite: false, depthTest: false });
  const background = new Mesh(backgroundGeometry, backgroundMaterial);
  background.frustumCulled = false;
  background.renderOrder = -1;
  scene.add(background);

  const compact = window.matchMedia("(max-width: 767px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const geometry = new SphereGeometry(1, compact.matches ? 32 : 48, compact.matches ? 32 : 48);
  const material = new ShaderMaterial({ uniforms, vertexShader: sphereVertex, fragmentShader: sphereShader, transparent: true });
  const spheres = [
    { scale: 4.2, x: 6.5, y: -1.2, z: -1.5, speed: 0.002 },
    { scale: 1.8, x: -6, y: -4, z: 2.5, speed: 0.004 },
    { scale: 1.1, x: -4.5, y: 4.2, z: -2, speed: 0.005 },
    { scale: 0.75, x: 3, y: 5.5, z: 4, speed: 0.008 },
  ].map((data, index) => {
    const mesh = new Mesh(geometry, material);
    mesh.scale.setScalar(data.scale);
    mesh.position.set(data.x, data.y, data.z);
    scene.add(mesh);
    return { mesh, ...data, phase: index * 1.7 };
  });

  let width = 0, height = 0, frame = 0, lastFrame = 0, time = 0;
  let targetX = 0, targetY = 0;
  let intersecting = true, contextLost = false, failed = false, destroyed = false, suspended = false;
  const events = new AbortController();
  const options = { signal: events.signal, passive: true };

  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }

  function visible() {
    return !destroyed && !failed && !contextLost && !suspended && !editor.hidden && !view!.hidden && !document.hidden && intersecting && width > 0 && height > 0;
  }

  function draw(delta: number) {
    const easing = 1 - Math.exp(-delta * 4);
    camera.position.x += ((reduced.matches ? 0 : targetX) - camera.position.x) * easing;
    camera.position.y += ((reduced.matches ? 0 : targetY) - camera.position.y) * easing;
    camera.lookAt(0, 0, 0);
    uniforms.u_time.value = time;
    for (let i = 0; i < spheres.length; i++) {
      const sphere = spheres[i];
      sphere.mesh.position.y = sphere.y + Math.sin(time * sphere.speed * 120 + sphere.phase) * 0.5;
      sphere.mesh.rotation.x = time * sphere.speed * 18;
      sphere.mesh.rotation.y = time * sphere.speed * 24;
    }
    try {
      renderer.render(scene, camera);
      editor.dataset.fieldState = reduced.matches ? "static" : "ready";
    } catch {
      failed = true;
      stop();
      editor.dataset.fieldState = "fallback";
    }
  }

  function animate(now: number) {
    frame = 0;
    if (!visible() || reduced.matches) return;
    const interval = 1000 / (compact.matches ? 24 : 30);
    if (!lastFrame || now - lastFrame >= interval) {
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.08) : 1 / 30;
      lastFrame = now;
      time += delta;
      draw(delta);
    }
    if (!failed) frame = window.requestAnimationFrame(animate);
  }

  function reconcile() {
    stop();
    if (!visible()) return;
    if (reduced.matches) {
      targetX = targetY = camera.position.x = camera.position.y = 0;
      draw(0);
    } else {
      draw(1 / 30);
      frame = window.requestAnimationFrame(animate);
    }
  }

  function resize() {
    if (destroyed || editor.hidden || view!.hidden) return;
    const bounds = editor.getBoundingClientRect();
    width = Math.round(bounds.width);
    height = Math.round(bounds.height);
    if (!width || !height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, compact.matches ? 1 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(uniforms.u_resolution.value);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const framing = Math.max(0.38, Math.min(1, camera.aspect / 1.35));
    for (let i = 0; i < spheres.length; i++) spheres[i].mesh.position.x = spheres[i].x * framing;
    reconcile();
  }

  function pointer(event: PointerEvent) {
    if (reduced.matches || !visible()) return;
    const bounds = editor.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    targetX = x * (compact.matches ? 0.9 : 1.5);
    targetY = -y * 1.1;
  }
  function resetPointer() { targetX = targetY = 0; }
  function updateVisibility() { resize(); reconcile(); }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(editor);
  const visibilityObserver = new MutationObserver(updateVisibility);
  visibilityObserver.observe(editor, { attributes: true, attributeFilter: ["hidden"] });
  visibilityObserver.observe(view, { attributes: true, attributeFilter: ["hidden"] });
  const intersectionObserver = new IntersectionObserver((entries) => {
    intersecting = entries[0].isIntersecting;
    reconcile();
  });
  intersectionObserver.observe(editor);

  editor.addEventListener("pointermove", pointer, options);
  editor.addEventListener("pointerdown", pointer, options);
  editor.addEventListener("pointerleave", resetPointer, options);
  editor.addEventListener("pointerup", (event) => { if (event.pointerType !== "mouse") resetPointer(); }, options);
  editor.addEventListener("pointercancel", resetPointer, options);
  document.addEventListener("visibilitychange", reconcile, options);
  reduced.addEventListener("change", reconcile, options);
  compact.addEventListener("change", resize, options);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    stop();
    editor.dataset.fieldState = "fallback";
  }, { signal: events.signal });
  canvas.addEventListener("webglcontextrestored", () => { contextLost = false; resize(); }, options);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stop();
    events.abort();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    intersectionObserver.disconnect();
    backgroundGeometry.dispose();
    backgroundMaterial.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    instances.delete(editor);
  }
  window.addEventListener("pagehide", (event) => { suspended = true; stop(); if (!event.persisted) destroy(); }, options);
  window.addEventListener("pageshow", () => { suspended = false; reconcile(); }, options);
  const instance = { destroy };
  instances.set(editor, instance);
  resize();
  return instance;
}
