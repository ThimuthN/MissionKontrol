// Adapted from the user-supplied Light Ripple skill. The shader's concentric
// arcs are a visual metaphor for signals travelling between source systems.
// This is purely decorative: the case model and controls remain independent.
const host = document.querySelector('.scene-frame');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pointerFine = matchMedia('(pointer: fine) and (hover: hover)');

async function mountRipple() {
  if (!host || !window.WebGLRenderingContext) return;
  let THREE;
  try { THREE = await import('/three.module.js'); } catch { return; }

  const container = document.createElement('div');
  container.className = 'light-ripple';
  container.setAttribute('aria-hidden', 'true');
  host.prepend(container);

  const vertexShader = 'void main() { gl_Position = vec4(position, 1.0); }';
  const fragmentShader = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float uLineWidth;
    uniform float uDispersion;
    uniform vec3 uTint;
    uniform float uUseTint;
    uniform float uBrightness;
    uniform vec2 uPointer;
    void main(void) {
      vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
      uv -= (uPointer - .5) * .14;
      float t = time * 0.05;
      vec3 color = vec3(0.0);
      for (int j = 0; j < 3; j++) {
        for (int i = 0; i < 5; i++) {
          color[j] += uLineWidth * float(i * i) /
            abs(fract(t - uDispersion * float(j) + float(i) * 0.01) * 5.0
              - length(uv) + mod(uv.x + uv.y, 0.2));
        }
      }
      float mono = (color.r + color.g + color.b) / 3.0;
      vec3 finalColor = mix(color, mono * uTint, uUseTint);
      gl_FragColor = vec4(finalColor * uBrightness, 1.0);
    }
  `;

  let renderer;
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    time: { value: 1 },
    resolution: { value: new THREE.Vector2() },
    uLineWidth: { value: .0017 },
    uDispersion: { value: .01 },
    uTint: { value: new THREE.Vector3(.25, .94, .85) },
    uUseTint: { value: 1 },
    uBrightness: { value: .72 },
    uPointer: { value: new THREE.Vector2(.5, .5) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();
  camera.position.z = 1;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    container.append(renderer.domElement);
  } catch {
    material.dispose(); geometry.dispose(); container.remove(); return;
  }

  let targetX = .5, targetY = .5;
  let raf = 0;
  let previousFrame = 0;
  let lastPaused = false;
  function resize() {
    const rect = host.getBoundingClientRect();
    renderer.setSize(Math.max(1,rect.width), Math.max(1,rect.height), false);
    uniforms.resolution.value.set(renderer.domElement.width, renderer.domElement.height);
  }
  function frame(now = 0) {
    const paused = reduceMotion.matches || document.hidden || document.documentElement.classList.contains('motion-paused');
    // Avoid dedicating a 60/120 Hz GPU animation to a decorative surface.
    // A motion pause renders its final frame once, then stays quiet.
    if ((!paused && now - previousFrame >= 32) || (paused && !lastPaused)) {
      if (!paused) uniforms.time.value += .025; // Calm preset: speed 0.5.
      uniforms.uPointer.value.x += (targetX - uniforms.uPointer.value.x) * .07;
      uniforms.uPointer.value.y += (targetY - uniforms.uPointer.value.y) * .07;
      renderer.render(scene, camera);
      previousFrame = now;
    }
    lastPaused = paused;
    raf = requestAnimationFrame(frame);
  }
  function point(event) {
    if (!pointerFine.matches || event.pointerType === 'touch') return;
    const rect = host.getBoundingClientRect();
    targetX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    targetY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  }
  host.addEventListener('pointermove', point, { passive: true });
  host.addEventListener('pointerleave', () => { targetX = .5; targetY = .5; });
  window.addEventListener('resize', resize, { passive: true });
  resize();
  frame();
  // The canvas is a progressive enhancement; if the GPU context disappears,
  // the authored SVG trail and gradient continue to carry the visual system.
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    material.dispose(); geometry.dispose(); renderer.dispose(); container.remove();
  }, { once: true });
}

void mountRipple();
