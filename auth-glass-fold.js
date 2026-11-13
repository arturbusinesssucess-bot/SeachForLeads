// Adapted from GradFlow's foldGradient shader by Meer Bahadin.
// Original repository: https://github.com/meerbahadin/gradflow (MIT License).
const canvas = document.querySelector(".auth-glass-fold");
const panel = canvas?.closest(".auth-intro");
if (!canvas || !panel) throw new Error("Glass Fold canvas was not found.");

const gl = canvas.getContext("webgl", {
  alpha: false,
  antialias: false,
  depth: false,
  powerPreference: "low-power",
});
if (!gl) {
  canvas.hidden = true;
} else {
  const vertexSource = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    varying vec2 vUv;
    #define PI 3.14159265359
    mat2 Rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }
    vec2 centered(vec2 uv) {
      vec2 p = uv - 0.5;
      p.x *= u_resolution.x / max(u_resolution.y, 1.0);
      return p;
    }
    vec3 foldGradient(vec2 uv, float time) {
      vec2 q = Rot(0.6) * centered(uv) * 2.0;
      float t = time * 0.6;
      float pixel = 2.0 / max(u_resolution.y, 1.0);
      vec3 color2 = vec3(0.0235, 0.0314, 0.1176);
      vec3 base = mix(color2, color2 * 0.45,
                      clamp(length(centered(uv)) * 1.3, 0.0, 1.0));
      vec3 color = base;
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float bend = mod(fi, 2.0) * 2.0 - 1.0;
        float crease = (fi - 2.5) * 0.4
                     + 0.26 * sin(q.x * (1.05 + 0.12 * fi) + fi * 1.9 + t * (0.25 + 0.05 * fi))
                     + 0.1 * bend * q.x * q.x;
        float s = q.y - crease;
        float pane = smoothstep(-pixel, pixel, s);
        float back = max(s, 0.0);
        float body = exp(-back * 1.7);
        float fresnel = exp(-back * 8.0);
        float rim = exp(-back * 80.0);
        float inner = exp(-pow((back - 0.045) / 0.014, 2.0));
        float bloom = exp(-abs(s) * 20.0);
        vec3 color1 = vec3(0.1176, 0.2353, 0.7843);
        vec3 color3 = vec3(0.5882, 0.8431, 1.0);
        vec3 tint = mix(color1, color3, clamp(fresnel * 0.6 + 0.08
                    + 0.14 * sin(fi * 2.1 + q.x * 0.8 + t * 0.2), 0.0, 1.0));
        vec3 light = tint * pane * (body * 0.42 + fresnel * 0.4)
                   + color3 * (pane * (rim * 0.6 + inner * 0.12) + bloom * 0.1);
        color += light * (1.0 - color);
      }
      return clamp(color, 0.0, 1.0);
    }
    void main() {
      gl_FragColor = vec4(foldGradient(vUv, u_time), 1.0);
    }
  `;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || "Glass Fold shader compilation failed.");
    }
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Glass Fold program failed to link.");
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  let frame = 0;
  let start = performance.now();
  function resize() {
    const rect = panel.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform2f(resolutionLocation, width, height);
  }
  function render(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    resize();
    gl.uniform1f(timeLocation, reduceMotion.matches ? 0 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduceMotion.matches) frame = requestAnimationFrame(render);
  }
  function startRender() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render);
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) startRender();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  observer.observe(panel);
  new ResizeObserver(() => {
    resize();
    if (reduceMotion.matches && visible) render(performance.now());
  }).observe(panel);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else startRender();
  });
  reduceMotion.addEventListener("change", () => {
    start = performance.now();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    startRender();
  });
  startRender();
}
