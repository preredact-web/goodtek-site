// The Ava-inspired brain sphere — translucent gel shell, inner neural filaments, warm amber glow.
// Reactive: tilts toward cursor, ripples on hover, expands on click, rotates on drag.

const { useRef, useEffect, useState, useMemo } = React;

// ---------- Filament generator ----------
// Generate a deterministic set of 3D points that look like neural filaments inside a sphere.
function generateFilaments(seed = 1, count = 24) {
  // Tiny seeded RNG
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const filaments = [];
  for (let i = 0; i < count; i++) {
    // Each filament is a multi-segment spline with several control "bumps" —
    // gives organic, fluid, multi-curve shapes (not just single arcs).
    const startTheta = rand() * Math.PI * 2;
    const startPhi = Math.acos(2 * rand() - 1);
    const endTheta = rand() * Math.PI * 2;
    const endPhi = Math.acos(2 * rand() - 1);

    const r = 0.95;
    const start = [
      r * Math.sin(startPhi) * Math.cos(startTheta),
      r * Math.sin(startPhi) * Math.sin(startTheta),
      r * Math.cos(startPhi),
    ];
    const end = [
      r * Math.sin(endPhi) * Math.cos(endTheta),
      r * Math.sin(endPhi) * Math.sin(endTheta),
      r * Math.cos(endPhi),
    ];

    // Build 1–2 intermediate waypoints — enough for fluid curves without sharp kinks
    const segs = 1 + Math.floor(rand() * 2); // 1..2 inner waypoints
    const ctrl = [start];
    for (let k = 1; k <= segs; k++) {
      const u = k / (segs + 1);
      const lx = start[0] * (1 - u) + end[0] * u;
      const ly = start[1] * (1 - u) + end[1] * u;
      const lz = start[2] * (1 - u) + end[2] * u;
      const pull = 0.3 + rand() * 0.5;
      const cx0 = lx * (1 - pull);
      const cy0 = ly * (1 - pull);
      const cz0 = lz * (1 - pull);
      // Smaller wiggle — keeps curves graceful instead of zigzagging
      const wig = 0.32;
      ctrl.push([
        cx0 + (rand() - 0.5) * wig,
        cy0 + (rand() - 0.5) * wig,
        cz0 + (rand() - 0.5) * wig,
      ]);
    }
    ctrl.push(end);
    const cr = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];

    // More samples per segment — smoother, more fluid spline
    const samplesPerSeg = 30;
    const pts = [];
    for (let k = 1; k < cr.length - 2; k++) {
      const p0 = cr[k - 1], p1 = cr[k], p2 = cr[k + 1], p3 = cr[k + 2];
      for (let j = 0; j < samplesPerSeg; j++) {
        const t = j / samplesPerSeg;
        const t2 = t * t, t3 = t2 * t;
        const out = [0, 0, 0];
        for (let d = 0; d < 3; d++) {
          out[d] = 0.5 * (
            (2 * p1[d]) +
            (-p0[d] + p2[d]) * t +
            (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
            (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3
          );
        }
        pts.push(out);
      }
    }
    pts.push(end);

    filaments.push({
      points: pts,
      thickness: 0.45 + rand() * 0.55,
      brightness: 0.5 + rand() * 0.5,
      pulseOffset: rand() * Math.PI * 2,
      pulseSpeed: 0.5 + rand() * 0.7,
    });
  }

  // Synapse nodes — more, denser, with size variation and clustering
  const nodes = [];
  // Volume cloud
  for (let i = 0; i < 80; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = Math.pow(rand(), 0.5) * 0.88;
    nodes.push({
      pos: [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ],
      size: 0.4 + rand() * 1.6,
      pulseOffset: rand() * Math.PI * 2,
      pulseSpeed: 0.4 + rand() * 1.2,
    });
  }
  // Tight clusters — little knots of synapses
  for (let c = 0; c < 4; c++) {
    const ctheta = rand() * Math.PI * 2;
    const cphi = Math.acos(2 * rand() - 1);
    const cr = 0.3 + rand() * 0.5;
    const center = [
      cr * Math.sin(cphi) * Math.cos(ctheta),
      cr * Math.sin(cphi) * Math.sin(ctheta),
      cr * Math.cos(cphi),
    ];
    const k = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < k; i++) {
      const dr = 0.04 + rand() * 0.10;
      nodes.push({
        pos: [
          center[0] + (rand() - 0.5) * dr * 2,
          center[1] + (rand() - 0.5) * dr * 2,
          center[2] + (rand() - 0.5) * dr * 2,
        ],
        size: 0.5 + rand() * 1.4,
        pulseOffset: rand() * Math.PI * 2,
        pulseSpeed: 0.5 + rand() * 1.4,
      });
    }
  }

  return { filaments, nodes };
}

// ---------- 3D vector & sphere helpers (used by surface neuron layer) ----------
function unit3(v) {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0]/m, v[1]/m, v[2]/m];
}
function addScaled3(a, b, s) {
  return [a[0] + b[0]*s, a[1] + b[1]*s, a[2] + b[2]*s];
}
function dot3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function slerp3(a, b, t) {
  // spherical linear interpolation between two unit vectors
  const cosT = Math.max(-1, Math.min(1, dot3(a, b)));
  const theta = Math.acos(cosT);
  if (theta < 1e-4) return [a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1]), a[2]+t*(b[2]-a[2])];
  const s = Math.sin(theta);
  const c1 = Math.sin((1-t)*theta)/s, c2 = Math.sin(t*theta)/s;
  return [a[0]*c1 + b[0]*c2, a[1]*c1 + b[1]*c2, a[2]*c1 + b[2]*c2];
}
// A unit tangent vector at point p on sphere, rotated by `ang` in tangent plane
function tangentOnSphere(p, ang) {
  // Build orthonormal basis on tangent plane at p
  // Choose helper not parallel to p
  const helper = Math.abs(p[1]) < 0.9 ? [0,1,0] : [1,0,0];
  const e1 = unit3([
    helper[0] - p[0]*dot3(helper,p),
    helper[1] - p[1]*dot3(helper,p),
    helper[2] - p[2]*dot3(helper,p),
  ]);
  // e2 = p × e1
  const e2 = [
    p[1]*e1[2] - p[2]*e1[1],
    p[2]*e1[0] - p[0]*e1[2],
    p[0]*e1[1] - p[1]*e1[0],
  ];
  const c = Math.cos(ang), s = Math.sin(ang);
  return [e1[0]*c + e2[0]*s, e1[1]*c + e2[1]*s, e1[2]*c + e2[2]*s];
}
function hexR(h){ const x = parseInt(h.replace('#',''), 16); return (x>>16)&255; }
function hexG(h){ const x = parseInt(h.replace('#',''), 16); return (x>>8)&255; }
function hexB(h){ const x = parseInt(h.replace('#',''), 16); return x&255; }

// ---------- Project 3D point to 2D with rotation ----------
function project(p, rotX, rotY, radius, cx, cy) {
  // Rotate around Y
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  let x = p[0] * cosY - p[2] * sinY;
  let z = p[0] * sinY + p[2] * cosY;
  let y = p[1];
  // Rotate around X
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const y2 = y * cosX - z * sinX;
  const z2 = y * sinX + z * cosX;
  y = y2;
  z = z2;

  // Perspective
  const focal = 2.4;
  const persp = focal / (focal - z);
  return {
    x: cx + x * radius * persp,
    y: cy + y * radius * persp,
    z, // keep z for depth sorting / fog
    persp,
  };
}

// ---------- The Sphere ----------
function BrainSphere({
  size = 560,
  intensity = 1,
  reactive = true,
  amber = "#ffb547",
  amberBright = "#ffd584",
  amberDeep = "#d97706",
  filamentCount = 28,
  seed = 7,
  className,
  style,
  onClick,
  dynamicsRef = null,        // optional ref of { intensity, spinSpeed, electrify } read each frame
  externalStateRef = null,   // optional shared rotation state
  externalSizeRef = null,    // optional ref that receives { baseR, cx, cy } each frame
  surfaceNodes = null,       // [{ id, pos: [x,y,z], color, importance, tendrilSeed }]
  surfaceEdges = null,       // [{ a: nodeId, b: nodeId, weight }]
  pulsesRef = null,          // ref to array of active pulses { from, to, t, life, color }
  pixelRatio = null,         // override device pixel ratio (boost for tiny render targets)
  tintColor = null,          // optional in-canvas color tint (e.g. "#1aa050" for green)
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const internalStateRef = useRef({});
  const stateRef = externalStateRef || internalStateRef;
  if (!stateRef.current || !('mouseX' in stateRef.current)) stateRef.current = {
    mouseX: 0,
    mouseY: 0,
    // baseRot is the persistent orientation (idle spin + drag commits)
    baseRotX: 0,
    baseRotY: 0,
    // nudge is the small additive cursor parallax that decays back to 0
    nudgeX: 0,
    nudgeY: 0,
    targetNudgeX: 0,
    targetNudgeY: 0,
    rotX: 0,
    rotY: 0,
    spinY: 0, // continuous idle spin (added to baseRotY)
    ripple: 0,
    expand: 1,
    targetExpand: 1,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartBaseX: 0,
    dragStartBaseY: 0,
    hovered: false,
    t: 0,
  };

  const { filaments, nodes } = useMemo(
    () => generateFilaments(seed, filamentCount),
    [seed, filamentCount]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");

    const dpr = pixelRatio != null ? pixelRatio : Math.min(window.devicePixelRatio || 1, 2);
    // Use the `size` prop directly instead of measuring the wrap element.
    // getBoundingClientRect returns post-transform dimensions — if a parent
    // applies CSS transform:scale to shrink the orb visually, measurement
    // would shrink the canvas resolution too. Trusting the size prop lets
    // callers render BrainSphere at native 160px and CSS-scale to any UI size.
    const setSize = () => {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
    };
    setSize();

    let raf;
    let last = performance.now();

    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = stateRef.current;
      st.t += dt;

      // Live dynamics (read each frame from ref, fall back to props)
      const dyn = (dynamicsRef && dynamicsRef.current) || null;
      const liveIntensity = dyn ? dyn.intensity : intensity;
      const liveSpin = dyn ? dyn.spinSpeed : 0.08;
      const electrify = dyn ? (dyn.electrify || 0) : 0;
      const nodeElectrify = dyn && dyn.nodeElectrify != null ? dyn.nodeElectrify : electrify;

      // Idle spin always present — accumulates into baseRotY
      if (!st.dragging) st.baseRotY += dt * liveSpin;

      // Ease nudge toward target (small cursor parallax that decays)
      const ease = 1 - Math.pow(0.001, dt);
      st.nudgeX += (st.targetNudgeX - st.nudgeX) * ease;
      st.nudgeY += (st.targetNudgeY - st.nudgeY) * ease;
      // Final rotation = persistent base + small nudge
      st.rotX = st.baseRotX + st.nudgeX;
      st.rotY = st.baseRotY + st.nudgeY;
      st.expand += (st.targetExpand - st.expand) * (1 - Math.pow(0.0005, dt));
      // Decay ripple
      st.ripple = Math.max(0, st.ripple - dt * 1.4);

      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const baseR = (Math.min(w, h) / 2) * 0.78 * st.expand;

      // Publish CSS-px geometry for HTML overlays (dots, labels)
      if (externalSizeRef) {
        const cssR = baseR / dpr;
        externalSizeRef.current = {
          cx: cx / dpr, cy: cy / dpr, baseR: cssR,
          rotX: st.rotX, rotY: st.rotY, t: st.t,
        };
      }

      // ----- Outer ambient glow (cool halo, Ex Machina blue) -----
      const halo = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, baseR * 1.9);
      halo.addColorStop(0, `rgba(140, 195, 230, ${0.16 * liveIntensity})`);
      halo.addColorStop(0.4, `rgba(110, 170, 215, ${0.07 * liveIntensity})`);
      halo.addColorStop(1, "rgba(110, 170, 215, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // ----- Soft inner core glow — icy blue-white (toned down so filaments read) -----
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
      const corePulse = 0.55 + Math.sin(st.t * 1.3) * 0.08 + (st.hovered ? 0.12 : 0) + st.ripple * 0.4;
      coreGlow.addColorStop(0, `rgba(225, 240, 255, ${0.28 * corePulse * liveIntensity})`);
      coreGlow.addColorStop(0.35, `rgba(150, 195, 230, ${0.16 * corePulse * liveIntensity})`);
      coreGlow.addColorStop(0.75, `rgba(70, 110, 150, ${0.06 * liveIntensity})`);
      coreGlow.addColorStop(1, `rgba(70, 110, 150, 0)`);
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // ----- Translucent gel shell (back hemisphere) - sits behind filaments -----
      // We draw the back of the sphere as a faint shell first, then filaments, then front shell.
      // For simplicity: draw ONE shell behind, with a darker rim that fades.

      // ----- Filaments — depth sorted segments -----
      const totalRotY = st.rotY;
      const totalRotX = st.rotX;

      // Collect all segments with z for sorting
      const segs = [];
      for (let i = 0; i < filaments.length; i++) {
        const fil = filaments[i];
        const projPts = fil.points.map((p) =>
          project(p, totalRotX, totalRotY, baseR, cx, cy)
        );
        for (let j = 0; j < projPts.length - 1; j++) {
          const a = projPts[j], b = projPts[j + 1];
          const z = (a.z + b.z) / 2;
          segs.push({ a, b, z, fil, t: j / projPts.length });
        }
      }

      // Nodes
      const projNodes = nodes.map((n) => ({
        ...n,
        proj: project(n.pos, totalRotX, totalRotY, baseR, cx, cy),
      }));

      // Sort everything back-to-front
      const all = [
        ...segs.map((s) => ({ kind: "seg", z: s.z, data: s })),
        ...projNodes.map((n) => ({ kind: "node", z: n.proj.z, data: n })),
      ].sort((a, b) => a.z - b.z);

      // Draw back-half shell (rim faint behind) — cool blue gel
      ctx.save();
      const backShell = ctx.createRadialGradient(cx, cy, baseR * 0.7, cx, cy, baseR);
      backShell.addColorStop(0, "rgba(180,210,235,0.0)");
      backShell.addColorStop(0.85, "rgba(170,205,230,0.05)");
      backShell.addColorStop(1, "rgba(140,185,220,0.20)");
      ctx.fillStyle = backShell;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw segments + nodes with depth fog — high contrast for legibility
      for (const item of all) {
        if (item.kind === "seg") {
          const { a, b, fil, t } = item.data;
          const depth = (a.z + b.z) / 2;
          const fog = (depth + 1) / 2; // 0 back, 1 front
          // Electrified pulse: amplitude jumps, sparkle frequency increases, occasional bright "zaps".
          const fastPulse = Math.sin(st.t * fil.pulseSpeed * 2 + fil.pulseOffset + t * 6);
          // Multiple high-frequency sparkle bands stacked for a true "electric current" feel.
          const sparkle1 = Math.sin(st.t * (16 + fil.pulseSpeed * 8) + fil.pulseOffset * 3 + t * 22);
          const sparkle2 = Math.sin(st.t * (28 + fil.pulseSpeed * 11) + fil.pulseOffset * 7 + t * 38);
          const zap1 = Math.max(0, Math.sin(st.t * 18 + fil.pulseOffset * 7 + t * 30)) ** 5;
          const zap2 = Math.max(0, Math.sin(st.t * 26 + fil.pulseOffset * 11 + t * 44)) ** 7;
          const pulse = 0.7
            + fastPulse * (0.3 + electrify * 0.7)
            + (sparkle1 + sparkle2) * electrify * 0.35
            + (zap1 + zap2) * electrify * 1.9;
          // Lift back-side alpha so the lattice reads through the gel
          const alpha = (0.45 + 0.50 * fog) * fil.brightness * pulse * liveIntensity;
          const lw = fil.thickness * a.persp * dpr * 0.85;

          // Soft silhouette underlay for back filaments — gentle, gel-suspended
          if (fog < 0.55) {
            ctx.strokeStyle = `rgba(40,65,95,${(0.55 - fog) * 0.22 * fil.brightness * pulse})`;
            ctx.lineWidth = Math.max(1.4, lw * 2.6);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }

          // Wide soft glow pass — gel diffusion (more pronounced)
          const r = Math.round(190 + 65 * fog);
          const g = Math.round(215 + 40 * fog);
          const bl = Math.round(235 + 20 * fog);
          ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha * 0.50})`;
          ctx.lineWidth = Math.max(1.8, lw * 3.8);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          // Mid soft pass
          ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha * 0.7})`;
          ctx.lineWidth = Math.max(1.0, lw * 1.8);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          // Bright thin core — the actual filament (softened)
          ctx.strokeStyle = `rgba(${Math.min(255,r+15)},${Math.min(255,g+10)},${Math.min(255,bl+5)},${alpha * 0.78})`;
          ctx.lineWidth = Math.max(0.7, lw * 1.0);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        } else {
          const n = item.data;
          const fog = (n.proj.z + 1) / 2;
          const nFast = Math.sin(st.t * n.pulseSpeed * 2 + n.pulseOffset);
          const nFlick1 = Math.sin(st.t * (16 + n.pulseSpeed * 7) + n.pulseOffset * 4);
          const nFlick2 = Math.sin(st.t * (29 + n.pulseSpeed * 12) + n.pulseOffset * 9);
          const nZap = Math.max(0, Math.sin(st.t * 22 + n.pulseOffset * 9)) ** 6;
          const nZap2 = Math.max(0, Math.sin(st.t * 33 + n.pulseOffset * 13)) ** 9;
          const pulse = 0.55 + nFast * (0.45 + nodeElectrify * 0.5)
            + (nFlick1 + nFlick2) * nodeElectrify * 0.45
            + (nZap + nZap2) * nodeElectrify * 2.2;
          const r = n.size * n.proj.persp * dpr * 1.05 * (0.7 + 0.3 * fog) * (1 + nodeElectrify * 0.7);
          const a2 = (0.55 + 0.45 * fog) * pulse * liveIntensity;
          // Larger soft halo so each node reads as a glowing point
          const grad = ctx.createRadialGradient(n.proj.x, n.proj.y, 0, n.proj.x, n.proj.y, r * 6);
          grad.addColorStop(0, `rgba(230,242,255,${a2 * 0.9})`);
          grad.addColorStop(0.35, `rgba(150,200,235,${a2 * 0.45})`);
          grad.addColorStop(1, `rgba(140,190,225,0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.proj.x, n.proj.y, r * 6, 0, Math.PI * 2);
          ctx.fill();
          // Hot center dot — brighter and slightly larger
          ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a2 * 1.2)})`;
          ctx.beginPath();
          ctx.arc(n.proj.x, n.proj.y, Math.max(0.8, r * 1.2), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ----- Surface neurons & connections (project layer) -----
      if (surfaceNodes && surfaceNodes.length) {
        // Project all surface nodes (radius slightly above gel surface)
        const sn = surfaceNodes.map(n => {
          const proj = project(n.pos, totalRotX, totalRotY, baseR * 1.0, cx, cy);
          return { ...n, proj, fog: (proj.z + 1) / 2 };
        });
        const byId = {};
        for (const n of sn) byId[n.id] = n;

        // CLIP everything below to the sphere disk so nothing leaks past the silhouette
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.clip();

        // Compute a per-node "limb fade" — fade nodes as they approach the silhouette to prevent
        // them looking like they're floating off the edge.
        for (const n of sn) {
          // distance from sphere center in projected space (0 = center, 1 = silhouette)
          const dx = n.proj.x - cx, dy = n.proj.y - cy;
          const projDist = Math.sqrt(dx * dx + dy * dy) / baseR;
          // Gentle limb fade: start at 0.92, full at 0.99 (the disk clip handles the rest)
          const limbFade = projDist > 0.92 ? Math.max(0, 1 - (projDist - 0.92) / 0.07) : 1;
          n.fog = n.fog * limbFade;
        }

        // 1) Connection arcs — great-circle path from a to b on surface
        if (surfaceEdges && surfaceEdges.length) {
          for (let ei = 0; ei < surfaceEdges.length; ei++) {
            const e = surfaceEdges[ei];
            const A = byId[e.a], B = byId[e.b];
            if (!A || !B) continue;
            if (A.fog < 0.15 && B.fog < 0.15) continue;

            const segs = 24;
            const seedE = (ei * 0.731) % 1;
            const wobblePhase = seedE * Math.PI * 2;
            const pts = [];
            for (let i = 0; i <= segs; i++) {
              const t = i / segs;
              // pure great-circle arc — keep it on the surface
              const v = unit3(slerp3(A.pos, B.pos, t));
              const p = project(v, totalRotX, totalRotY, baseR * 1.005, cx, cy);
              pts.push({ p, t, fog: A.fog * (1-t) + B.fog * t });
            }

            ctx.lineCap = 'round';
            // Pass 1: wide soft glow underlay
            const fog = (A.fog + B.fog) / 2;
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
              if (i === 0) ctx.moveTo(pts[i].p.x, pts[i].p.y);
              else ctx.lineTo(pts[i].p.x, pts[i].p.y);
            }
            ctx.strokeStyle = `rgba(220,235,250,${(0.10 + fog * 0.14) * (e.weight || 1)})`;
            ctx.lineWidth = (1.8 + fog * 1.2) * dpr;
            ctx.stroke();

            // Pass 2: bright textured core — bright at endpoints (focal points), dim in the middle
            // (creates depth: lines feel like they emerge from focal points and fade into the gel)
            for (let i = 0; i < pts.length - 1; i++) {
              const t = pts[i].t;
              const undu = 0.65 + 0.35 * Math.sin(t * Math.PI * 3 + wobblePhase);
              const segFog = (pts[i].fog + pts[i+1].fog) / 2;
              // proximityToEnd: 1 at either endpoint, 0 at middle
              const prox = Math.pow(1 - Math.abs(t - 0.5) * 2, 1.3);
              // tint: pull color from nearest endpoint, more strongly when prox is high
              const near = t < 0.5 ? A : B;
              const localProx = t < 0.5 ? Math.pow(1 - t * 2, 1.3) : Math.pow((t - 0.5) * 2, 1.3);
              const rr = Math.round(245 - localProx * (245 - hexR(near.color)) * 0.4);
              const gg = Math.round(250 - localProx * (250 - hexG(near.color)) * 0.4);
              const bb = Math.round(255 - localProx * (255 - hexB(near.color)) * 0.3);
              const alpha = (0.12 + segFog * 0.20 + prox * 0.45) * (e.weight || 1) * undu;
              ctx.beginPath();
              ctx.moveTo(pts[i].p.x, pts[i].p.y);
              ctx.lineTo(pts[i+1].p.x, pts[i+1].p.y);
              ctx.strokeStyle = `rgba(${rr},${gg},${bb},${alpha})`;
              ctx.lineWidth = (0.4 + segFog * 0.5 * undu + prox * 0.5) * dpr;
              ctx.stroke();
            }
          }
        }

        // 1b) Active pulses traveling along edges (bright spark + tail)
        if (pulsesRef && pulsesRef.current && pulsesRef.current.length) {
          const alive = [];
          for (const pu of pulsesRef.current) {
            pu.t += dt / pu.life;
            if (pu.t < 1) alive.push(pu);
            const A = byId[pu.from], B = byId[pu.to];
            if (!A || !B) continue;
            const head = Math.min(1, pu.t);
            // short comet-like tail
            const tailSegs = 8;
            for (let i = 0; i < tailSegs; i++) {
              const tt = Math.max(0, head - (i / tailSegs) * 0.18);
              const tt2 = Math.max(0, head - ((i + 1) / tailSegs) * 0.18);
              if (tt2 <= 0) break;
              const v1 = slerp3(A.pos, B.pos, tt);
              const v2 = slerp3(A.pos, B.pos, tt2);
              const p1 = project(v1, totalRotX, totalRotY, baseR * 1.015, cx, cy);
              const p2 = project(v2, totalRotX, totalRotY, baseR * 1.015, cx, cy);
              const fade = 1 - (i / tailSegs);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(190,235,255,${fade * 0.7})`;
              ctx.lineWidth = (1.2 + fade * 1.2) * dpr;
              ctx.lineCap = 'round';
              ctx.stroke();
            }
            // bright head
            const vH = slerp3(A.pos, B.pos, head);
            const pH = project(vH, totalRotX, totalRotY, baseR * 1.02, cx, cy);
            const headG = ctx.createRadialGradient(pH.x, pH.y, 0, pH.x, pH.y, 6 * dpr);
            headG.addColorStop(0, 'rgba(255,255,255,0.95)');
            headG.addColorStop(0.4, 'rgba(180,230,255,0.6)');
            headG.addColorStop(1, 'rgba(140,200,240,0)');
            ctx.fillStyle = headG;
            ctx.beginPath();
            ctx.arc(pH.x, pH.y, 6 * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
          pulsesRef.current = alive;
        }

        // Vivid luminescent palette for project rings — ALL SHADES OF BLUE.
        // The base cluster colors are muted slate; rings need vibrant high-saturation glow.
        // We map every cluster to a different blue (cyan → azure → indigo → cobalt → sky)
        // so projects still differentiate without going green/purple/pink.
        const VIVID = {
          '#2a6ea8': [80, 220, 255],   // core-product → bright cyan
          '#5b8db8': [140, 210, 255],  // voice → light sky-blue
          '#1d4f7e': [70, 150, 255],   // infra → strong cobalt blue
          '#8a8174': [110, 180, 255],  // speculative → soft azure
          '#7c8898': [130, 165, 255],  // financial → periwinkle blue
          '#3a4554': [60, 200, 255],   // capital → electric blue
        };

        // 2) Luminescent rings + sweeping outward filaments (each project = a glowing ring
        //    encircled by long, flowing filaments that sweep out across the surface).
        for (const n of sn) {
          if (n.fog < 0.05) continue;
          const seed = (n.tendrilSeed || 1) * 1.3;
          // Vivid luminescent color for this project (look up by cluster hex)
          const vivColor = VIVID[n.color] || [120, 200, 255];
          const lR = vivColor[0], lG = vivColor[1], lB = vivColor[2];
          // Original muted color (for the dark "hole" in the ring center, multiply tint)
          const cR = hexR(n.color), cG = hexG(n.color), cB = hexB(n.color);
          // Ring radius (in arc-length on sphere). Importance is 1-5, normalize to 0-1.
          // FLOOR raised so all rings are at least as big as the previously-biggest one;
          // top importance projects get an extra bump to feel slightly larger.
          const impNorm = Math.max(0, Math.min(1, ((n.importance || 3) - 1) / 4));
          const ringArc = 0.030 + impNorm * 0.008;
          // Sample the ring as 3D points on the sphere surface around n.pos
          const ringSegs = 64;
          const ringPts3 = [];
          const u = tangentOnSphere(n.pos, 0);
          const v = tangentOnSphere(n.pos, Math.PI / 2);
          for (let i = 0; i <= ringSegs; i++) {
            const a = (i / ringSegs) * Math.PI * 2;
            const ca = Math.cos(a) * ringArc;
            const sa = Math.sin(a) * ringArc;
            const dx = u[0] * ca + v[0] * sa;
            const dy = u[1] * ca + v[1] * sa;
            const dz = u[2] * ca + v[2] * sa;
            ringPts3.push(unit3([n.pos[0] + dx, n.pos[1] + dy, n.pos[2] + dz]));
          }
          const ringPts2 = ringPts3.map(p => project(p, totalRotX, totalRotY, baseR * 1.012, cx, cy));

          // ---- Sweeping outward filaments around the ring ----
          const fcount = 26 + Math.floor(impNorm * 12);
          for (let k = 0; k < fcount; k++) {
            const ang = seed + k * (Math.PI * 2 / fcount) + Math.sin(st.t * 0.18 + k * 0.27) * 0.04;
            const swirlDir = (k % 2 === 0 ? 1 : -1) * (1 + Math.sin(seed + k * 0.6) * 0.25);
            const pseudo = (Math.sin(seed * (k + 1.7)) + 1) / 2;
            const startU = Math.cos(ang) * ringArc;
            const startV = Math.sin(ang) * ringArc;
            const start = unit3([
              n.pos[0] + u[0] * startU + v[0] * startV,
              n.pos[1] + u[1] * startU + v[1] * startV,
              n.pos[2] + u[2] * startU + v[2] * startV,
            ]);
            const lenBase = 0.030 + pseudo * 0.035;
            const sweepAng = ang + (Math.PI / 2) * swirlDir * (0.5 + pseudo * 0.4);
            const tipDir = tangentOnSphere(start, sweepAng);
            const tip = unit3(addScaled3(start, tipDir, lenBase));
            const midDir = tangentOnSphere(start, sweepAng + 0.3 * swirlDir);
            const ctrl = unit3(addScaled3(slerp3(start, tip, 0.4), midDir, 0.04 + pseudo * 0.03));

            const segs = 22;
            const pts = [];
            for (let i = 0; i <= segs; i++) {
              const t = i / segs;
              const aP = slerp3(start, ctrl, t);
              const bP = slerp3(ctrl, tip, t);
              const vP = unit3(slerp3(aP, bP, t));
              const filR = baseR * (1.006 - t * t * 0.020);
              pts.push(project(vP, totalRotX, totalRotY, filR, cx, cy));
            }
            ctx.lineCap = 'round';
            for (let i = 0; i < pts.length - 1; i++) {
              const t = i / (pts.length - 1);
              const bright = Math.pow(1 - t, 1.3);
              const undulation = 0.75 + 0.25 * Math.sin(t * Math.PI * 4 + seed + k);
              // Filaments are silver/white throughout — match the inner pathways, not the ring color.
              // Slight luminance variation along length for organic feel.
              const sil = 215 + Math.round(bright * 30); // 215 → 245
              const rr = sil + 5;  // 220-250
              const gg = sil + 10; // 225-255
              const bb = sil + 15; // 230-260 (clamped)
              const rrC = Math.min(255, rr);
              const ggC = Math.min(255, gg);
              const bbC = Math.min(255, bb);
              const alpha = (0.10 + bright * 0.40) * n.fog * undulation;
              const lw = (0.4 + bright * 0.7 * undulation) * dpr;
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[i+1].x, pts[i+1].y);
              ctx.strokeStyle = `rgba(${rrC},${ggC},${bbC},${alpha * 0.35})`;
              ctx.lineWidth = lw * 2.2;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[i+1].x, pts[i+1].y);
              ctx.strokeStyle = `rgba(${rrC},${ggC},${bbC},${alpha})`;
              ctx.lineWidth = lw;
              ctx.stroke();
            }
          }

          // ---- Luminescent ring ----
          const ringCenter = projectPt(n.pos, totalRotX, totalRotY, baseR, cx, cy);
          let ringScreenR = 0;
          for (const p of ringPts2) ringScreenR += Math.hypot(p.x - ringCenter.x, p.y - ringCenter.y);
          ringScreenR /= ringPts2.length;

          // (a) DARK inner disc — creates the "hole" of the ring (multiply blend darkens gel)
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          const hole = ctx.createRadialGradient(
            ringCenter.x, ringCenter.y, 0,
            ringCenter.x, ringCenter.y, ringScreenR * 1.05
          );
          // Tint toward cluster color but darker (pulls gel down to a deep cluster-tinted core)
          const dR = Math.round(80 + cR * 0.3);
          const dG = Math.round(95 + cG * 0.3);
          const dB = Math.round(120 + cB * 0.3);
          hole.addColorStop(0, `rgba(${dR},${dG},${dB},${0.55 * n.fog})`);
          hole.addColorStop(0.6, `rgba(${dR + 40},${dG + 40},${dB + 35},${0.30 * n.fog})`);
          hole.addColorStop(1, 'rgba(255,255,255,1)'); // multiply identity at edge
          ctx.fillStyle = hole;
          ctx.beginPath();
          ctx.arc(ringCenter.x, ringCenter.y, ringScreenR * 1.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Soft outer color glow — tight, just outside the ring
          const ringGlow = ctx.createRadialGradient(
            ringCenter.x, ringCenter.y, ringScreenR * 0.6,
            ringCenter.x, ringCenter.y, ringScreenR * 1.5
          );
          ringGlow.addColorStop(0, `rgba(${lR},${lG},${lB},${0.45 * n.fog})`);
          ringGlow.addColorStop(0.4, `rgba(${lR},${lG},${lB},${0.22 * n.fog})`);
          ringGlow.addColorStop(1, `rgba(${lR},${lG},${lB},0)`);
          ctx.fillStyle = ringGlow;
          ctx.beginPath();
          ctx.arc(ringCenter.x, ringCenter.y, ringScreenR * 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Pass 1: subtle outer halo — small bloom, not a giant orb
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ringPts2.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
          ctx.strokeStyle = `rgba(${lR},${lG},${lB},${0.45 * n.fog})`;
          ctx.lineWidth = 4.5 * dpr * (0.7 + n.fog * 0.5);
          ctx.stroke();

          // Pass 2: medium glow ring
          ctx.beginPath();
          ringPts2.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
          ctx.strokeStyle = `rgba(${lR},${lG},${lB},${0.95 * n.fog})`;
          ctx.lineWidth = 2.2 * dpr * (0.7 + n.fog * 0.5);
          ctx.stroke();

          // Pass 3: bright core ring — clearly defined
          const coreR = Math.min(255, lR + 60);
          const coreG = Math.min(255, lG + 50);
          const coreB = Math.min(255, lB + 40);
          ctx.beginPath();
          ringPts2.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
          ctx.strokeStyle = `rgba(${coreR},${coreG},${coreB},${1.0 * n.fog})`;
          ctx.lineWidth = 1.2 * dpr * (0.75 + n.fog * 0.4);
          ctx.stroke();

          // Pass 4: ultra-thin white-hot luminescent inner thread
          ctx.beginPath();
          ringPts2.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
          ctx.strokeStyle = `rgba(255,255,255,${0.95 * n.fog})`;
          ctx.lineWidth = 0.7 * dpr;
          ctx.stroke();
        }

        // 3) NO surface bloom — focal points are made entirely of converging swirl filaments above.
        // (Removed halo + inner brightening to avoid any circular shape on the surface.)

        // close the sphere-disk clip
        ctx.restore();
      }

      // ----- Front gel shell with fresnel rim -----
      // Rim + specular scale with liveIntensity so dimming actually dims
      // the bright highlights — necessary for hue-rotated tinted variants.
      ctx.save();
      const rim = ctx.createRadialGradient(
        cx - baseR * 0.45,
        cy - baseR * 0.5,
        baseR * 0.05,
        cx,
        cy,
        baseR * 1.02
      );
      rim.addColorStop(0, `rgba(255,255,255,${0.55 * liveIntensity})`);
      rim.addColorStop(0.15, `rgba(225,240,255,${0.15 * liveIntensity})`);
      rim.addColorStop(0.55, "rgba(180,215,240,0.0)");
      rim.addColorStop(0.92, "rgba(140,185,220,0.0)");
      rim.addColorStop(1.0, `rgba(140,185,220,${0.40 * liveIntensity})`);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fill();

      const spec = ctx.createRadialGradient(
        cx - baseR * 0.42,
        cy - baseR * 0.48,
        0,
        cx - baseR * 0.42,
        cy - baseR * 0.48,
        baseR * 0.30
      );
      spec.addColorStop(0, `rgba(255,255,255,${0.55 * liveIntensity})`);
      spec.addColorStop(0.35, `rgba(255,255,255,${0.08 * liveIntensity})`);
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      // Clip to sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Secondary smaller specular
      const spec2 = ctx.createRadialGradient(
        cx + baseR * 0.25,
        cy + baseR * 0.35,
        0,
        cx + baseR * 0.25,
        cy + baseR * 0.35,
        baseR * 0.18
      );
      spec2.addColorStop(0, `rgba(235,245,255,${0.18 * liveIntensity})`);
      spec2.addColorStop(1, "rgba(235,245,255,0)");
      ctx.fillStyle = spec2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      ctx.restore();

      // Ripple ring on hover/click
      if (st.ripple > 0.01) {
        const rr = baseR * (1 + (1 - st.ripple) * 0.5);
        ctx.strokeStyle = `rgba(180, 215, 240, ${0.7 * st.ripple})`;
        ctx.lineWidth = 2 * dpr * st.ripple;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (tintColor) {
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = tintColor;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // Interaction — rotation persists (no snap-back)
    const onMove = (e) => {
      if (!reactive) return;
      const rect = wrap.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const st = stateRef.current;
      st.mouseX = x;
      st.mouseY = y;
      if (st.dragging) {
        const dx = (e.clientX - st.dragStartX) / rect.width;
        const dy = (e.clientY - st.dragStartY) / rect.height;
        // Drag updates baseRot directly — stays where you leave it
        st.baseRotY = st.dragStartBaseY + dx * Math.PI * 2;
        st.baseRotX = st.dragStartBaseX + dy * Math.PI * 1.2;
        st.targetNudgeX = 0;
        st.targetNudgeY = 0;
      } else {
        // Small cursor parallax — added on top of base, decays when leaving
        st.targetNudgeY = (x - 0.5) * 0.18;
        st.targetNudgeX = (y - 0.5) * -0.12;
      }
    };
    const onLeave = () => {
      const st = stateRef.current;
      // Decay nudge to 0; keep baseRot intact
      st.targetNudgeX = 0;
      st.targetNudgeY = 0;
      st.hovered = false;
      st.targetExpand = 1;
      setHovered(false);
    };
    const onEnter = () => {
      const st = stateRef.current;
      st.hovered = true;
      st.ripple = 1;
      st.targetExpand = 1.04;
      setHovered(true);
    };
    const onDown = (e) => {
      const st = stateRef.current;
      st.dragging = true;
      st.dragStartX = e.clientX;
      st.dragStartY = e.clientY;
      st.dragStartBaseX = st.baseRotX;
      st.dragStartBaseY = st.baseRotY;
      st.ripple = 1;
      st.targetExpand = 1.08;
      wrap.setPointerCapture?.(e.pointerId);
    };
    const onUp = () => {
      const st = stateRef.current;
      st.dragging = false;
      st.targetExpand = st.hovered ? 1.04 : 1;
    };

    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerenter", onEnter);
    wrap.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    // Page-wide cursor parallax — small nudge only
    const onWindowMove = (e) => {
      if (!reactive) return;
      const st = stateRef.current;
      if (st.hovered || st.dragging) return;
      const rect = wrap.getBoundingClientRect();
      const cxw = rect.left + rect.width / 2;
      const cyw = rect.top + rect.height / 2;
      const dx = (e.clientX - cxw) / window.innerWidth;
      const dy = (e.clientY - cyw) / window.innerHeight;
      st.targetNudgeY = dx * 0.20;
      st.targetNudgeX = -dy * 0.14;
    };
    window.addEventListener("pointermove", onWindowMove);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointerenter", onEnter);
      wrap.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onWindowMove);
    };
  }, [filaments, nodes, intensity, reactive, dynamicsRef, pixelRatio, tintColor]);

  return (
    <div
      ref={wrapRef}
      onClick={onClick}
      className={className}
      style={{
        width: size,
        height: size,
        position: "relative",
        cursor: reactive ? "grab" : "default",
        touchAction: "none",
        ...style,
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

window.BrainSphere = BrainSphere;
