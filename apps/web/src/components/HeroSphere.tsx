"use client";
import { useEffect, useRef } from "react";

export function HeroSphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let animId: number;
    let renderer: any, scene: any, camera: any;

    import("three").then((THREE) => {
      const W = mount.clientWidth;
      const H = mount.clientHeight;

      // ── Scene ────────────────────────────────────────────────────────────
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
      camera.position.z = 5.5;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      // ── Fibonacci sphere particles ────────────────────────────────────────
      const COUNT = 900;
      const RADIUS = 2;

      const positions = new Float32Array(COUNT * 3);
      const basePositions = new Float32Array(COUNT * 3); // store original coords
      const sizes = new Float32Array(COUNT);
      const phiArr = new Float32Array(COUNT);
      const thetaArr = new Float32Array(COUNT);

      for (let i = 0; i < COUNT; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / COUNT);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        phiArr[i] = phi;
        thetaArr[i] = theta;

        const x = RADIUS * Math.sin(phi) * Math.cos(theta);
        const y = RADIUS * Math.sin(phi) * Math.sin(theta);
        const z = RADIUS * Math.cos(phi);

        positions[i * 3]     = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        basePositions[i * 3]     = x;
        basePositions[i * 3 + 1] = y;
        basePositions[i * 3 + 2] = z;

        sizes[i] = 2.5 + Math.random() * 2.5;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      // ── Shader material — glowing dots with depth fade ────────────────────
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor1: { value: new THREE.Color("#60a5fa") },  // blue
          uColor2: { value: new THREE.Color("#a78bfa") },  // purple
        },
        vertexShader: `
          attribute float size;
          uniform float uTime;
          varying float vAlpha;
          varying float vColorMix;

          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (280.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;

            // depth-based alpha — dots facing away are dimmer
            float depth = normalize(position).z;
            vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * depth);

            // latitude-based color mix
            float lat = atan(position.y, length(position.xz)) / 3.14159;
            vColorMix = 0.5 + lat;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          varying float vAlpha;
          varying float vColorMix;

          void main() {
            // soft circular dot
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float glow = 1.0 - smoothstep(0.0, 0.5, d);
            glow = pow(glow, 1.5);

            vec3 col = mix(uColor1, uColor2, clamp(vColorMix, 0.0, 1.0));
            gl_FragColor = vec4(col, glow * vAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geo, mat);
      scene.add(points);

      // ── Subtle connecting lines (icosphere-like mesh) ─────────────────────
      const lineGeo = new THREE.BufferGeometry();
      const lineVerts: number[] = [];
      // connect each particle to its 3 nearest neighbours — thin web
      for (let i = 0; i < COUNT; i++) {
        const xi = basePositions[i * 3], yi = basePositions[i * 3 + 1], zi = basePositions[i * 3 + 2];
        let nearest: { j: number; d: number }[] = [];
        for (let j = i + 1; j < COUNT; j++) {
          const dx = xi - basePositions[j * 3], dy = yi - basePositions[j * 3 + 1], dz = zi - basePositions[j * 3 + 2];
          const d = dx * dx + dy * dy + dz * dz;
          if (d < 0.28) nearest.push({ j, d }); // only very close ones
        }
        nearest.sort((a, b) => a.d - b.d);
        for (const { j } of nearest.slice(0, 2)) {
          lineVerts.push(xi, yi, zi, basePositions[j * 3], basePositions[j * 3 + 1], basePositions[j * 3 + 2]);
        }
      }
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(lineVerts, 3));
      const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.12 });
      const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(linesMesh);

      // ── Mouse parallax ───────────────────────────────────────────────────
      let mouseX = 0, mouseY = 0;
      const onMouse = (e: MouseEvent) => {
        const rect = mount.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
        mouseY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMouse);

      // ── Resize ───────────────────────────────────────────────────────────
      const onResize = () => {
        const w = mount.clientWidth, h = mount.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      // ── Animation loop ───────────────────────────────────────────────────
      const posAttr = geo.attributes.position as any;

      function animate() {
        animId = requestAnimationFrame(animate);
        const t = performance.now() * 0.001;
        mat.uniforms.uTime.value = t;

        // Slow base rotation
        points.rotation.y = t * 0.18;
        linesMesh.rotation.y = t * 0.18;

        // Mouse tilt
        points.rotation.x += (mouseY * 0.25 - points.rotation.x) * 0.05;
        linesMesh.rotation.x = points.rotation.x;

        // Audio-wave particle displacement
        for (let i = 0; i < COUNT; i++) {
          const phi = phiArr[i];
          const theta = thetaArr[i];

          // Two overlapping waves give the "rippling sphere" feel
          const wave1 = Math.sin(t * 1.8 + phi * 4.5) * 0.07;
          const wave2 = Math.sin(t * 1.1 + theta * 2.1 + phi * 2.0) * 0.055;
          const pulse = 1 + wave1 + wave2;
          const r = RADIUS * pulse;

          posAttr.setXYZ(
            i,
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi),
          );
        }
        posAttr.needsUpdate = true;

        renderer.render(scene, camera);
      }
      animate();

      // cleanup
      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("mousemove", onMouse);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    });

    return () => {
      cancelAnimationFrame(animId);
      if (renderer) {
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
