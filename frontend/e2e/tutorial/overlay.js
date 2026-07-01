// Language-neutral annotation overlay injected into the live app during tutorial
// recording. Exposes window.__cvn with a small choreography API (cursor, ring,
// ripple, step badge, animated download-progress card, full-screen title/terminal
// cards). No localized text is drawn here so the recorded master stays reusable.
window.__cvnInstallOverlay = function installOverlay() {
  if (window.__cvn && window.__cvn.__installed) return;

  const root = document.createElement("div");
  root.id = "cvn-overlay-root";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    overflow: "hidden",
    font: "600 15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif",
  });
  document.documentElement.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    @keyframes cvnpulse {
      0%,100% { box-shadow: 0 0 0 3px rgba(56,189,248,.30), 0 0 20px rgba(56,189,248,.45); }
      50% { box-shadow: 0 0 0 7px rgba(56,189,248,.10), 0 0 34px rgba(56,189,248,.75); }
    }
    @keyframes cvnblink { 0%,49% { opacity:1 } 50%,100% { opacity:0 } }
    #cvn-cursor svg { display:block }
  `;
  document.head.appendChild(style);

  // ---- cursor -------------------------------------------------------------
  const cursor = document.createElement("div");
  cursor.id = "cvn-cursor";
  cursor.innerHTML =
    '<svg width="32" height="40" viewBox="0 0 24 30"><path d="M2 2 L2 22 L7 17.5 L10.5 25.5 L14 24 L10.5 16 L17 16 Z" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  Object.assign(cursor.style, {
    position: "absolute",
    left: "0",
    top: "0",
    filter: "drop-shadow(0 3px 7px rgba(0,0,0,.55))",
    willChange: "transform",
    zIndex: "20",
  });
  root.appendChild(cursor);
  let cx = 720;
  let cy = 520;
  function place(x, y) {
    cx = x;
    cy = y;
    cursor.style.transform = `translate(${x - 3}px, ${y - 2}px)`;
  }
  place(cx, cy);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function rectOf(sel) {
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) return null;
    return el.getBoundingClientRect();
  }
  function centerOf(sel) {
    const r = rectOf(sel);
    if (!r) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  }

  function moveTo(x, y, ms) {
    const sx = cx;
    const sy = cy;
    const dur = ms == null ? 850 : ms;
    const t0 = performance.now();
    return new Promise((res) => {
      function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        const e = easeInOut(p);
        place(sx + (x - sx) * e, sy + (y - sy) * e);
        if (p < 1) requestAnimationFrame(step);
        else res();
      }
      requestAnimationFrame(step);
    });
  }
  async function moveToSel(sel, ms) {
    const c = centerOf(sel);
    if (!c) return false;
    await moveTo(c.x, c.y, ms);
    return true;
  }

  function ripple() {
    const d = document.createElement("div");
    Object.assign(d.style, {
      position: "absolute",
      left: cx + "px",
      top: cy + "px",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      border: "2px solid #38bdf8",
      transform: "translate(-50%,-50%)",
      zIndex: "15",
    });
    root.appendChild(d);
    d.animate(
      [
        { width: "10px", height: "10px", opacity: 1 },
        { width: "78px", height: "78px", opacity: 0 },
      ],
      { duration: 620, easing: "ease-out" }
    ).onfinish = () => d.remove();
    // little press dip on the cursor
    cursor.animate([{ transform: cursor.style.transform + " scale(1)" }, { transform: cursor.style.transform + " scale(.82)" }, { transform: cursor.style.transform + " scale(1)" }], { duration: 240 });
  }

  // ---- highlight ring -----------------------------------------------------
  let ring = null;
  function ringSel(sel, pad, radius) {
    const r = rectOf(sel);
    if (!r) return false;
    const p = pad == null ? 8 : pad;
    if (!ring) {
      ring = document.createElement("div");
      ring.id = "cvn-ring";
      root.appendChild(ring);
    }
    Object.assign(ring.style, {
      position: "absolute",
      left: r.left - p + "px",
      top: r.top - p + "px",
      width: r.width + 2 * p + "px",
      height: r.height + 2 * p + "px",
      border: "3px solid #38bdf8",
      borderRadius: (radius == null ? 14 : radius) + "px",
      animation: "cvnpulse 1.25s ease-in-out infinite",
      zIndex: "12",
    });
    ring.style.display = "block";
    return true;
  }
  function clearRing() {
    if (ring) ring.style.display = "none";
  }

  // ---- step badge (language neutral number) ------------------------------
  const badge = document.createElement("div");
  badge.id = "cvn-badge";
  Object.assign(badge.style, {
    position: "absolute",
    left: "312px",
    top: "22px",
    height: "42px",
    display: "none",
    alignItems: "center",
    gap: "8px",
    padding: "0 18px 0 6px",
    borderRadius: "999px",
    background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    color: "#fff",
    boxShadow: "0 8px 22px rgba(2,132,199,.45)",
    zIndex: "18",
  });
  const badgeNum = document.createElement("div");
  Object.assign(badgeNum.style, {
    width: "34px",
    height: "34px",
    margin: "4px",
    borderRadius: "50%",
    background: "rgba(255,255,255,.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    font: "800 18px/1 system-ui,sans-serif",
  });
  const badgeStep = document.createElement("div");
  Object.assign(badgeStep.style, { font: "800 15px/1 system-ui,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", opacity: ".95" });
  badgeStep.textContent = "STEP";
  badge.appendChild(badgeNum);
  badge.appendChild(badgeStep);
  root.appendChild(badge);
  function setBadge(n) {
    if (n == null) {
      badge.style.display = "none";
      return;
    }
    badgeNum.textContent = String(n);
    badge.style.display = "inline-flex";
  }

  // ---- full-screen scrim + title / terminal / end cards ------------------
  const scrim = document.createElement("div");
  Object.assign(scrim.style, {
    position: "absolute",
    inset: "0",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    background: "radial-gradient(1200px 700px at 50% 30%, rgba(2,6,23,.72), rgba(2,6,23,.94))",
    backdropFilter: "blur(3px)",
    zIndex: "19",
    textAlign: "center",
    color: "#e2e8f0",
  });
  root.appendChild(scrim);
  function showScrim(html) {
    scrim.innerHTML = html;
    scrim.style.display = "flex";
  }
  function hideScrim() {
    scrim.style.display = "none";
    scrim.innerHTML = "";
  }

  const LOGO =
    '<svg width="86" height="86" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7 h16 M5 7 l1 12 a2 2 0 0 0 2 2 h8 a2 2 0 0 0 2-2 l1-12"/><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M10 12 h4"/></svg>';

  function titleCard() {
    showScrim(
      `<div style="display:flex;flex-direction:column;align-items:center;gap:18px">
        <div style="filter:drop-shadow(0 0 26px rgba(56,189,248,.45))">${LOGO}</div>
        <div style="font:800 52px/1.05 system-ui,sans-serif;color:#f8fafc;letter-spacing:-.01em">Channel&nbsp;Vault&nbsp;NAS</div>
        <div style="height:3px;width:150px;border-radius:3px;background:linear-gradient(90deg,#0ea5e9,#6366f1)"></div>
      </div>`
    );
  }
  function endCard() {
    showScrim(
      `<div style="display:flex;flex-direction:column;align-items:center;gap:20px">
        <div style="font:800 40px/1.2 system-ui,sans-serif;color:#fbbf24;display:flex;align-items:center;gap:14px">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/></svg>
          Star it on GitHub
        </div>
        <div style="font:600 24px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd5e1">github.com/hyeonsangjeon/channel-vault-nas</div>
        <div style="margin-top:6px;filter:drop-shadow(0 0 22px rgba(56,189,248,.4))">${LOGO}</div>
      </div>`
    );
  }

  // ---- typed terminal card (language neutral commands) -------------------
  async function terminal(lines, opts) {
    opts = opts || {};
    showScrim(
      `<div id="cvn-term" style="width:1080px;max-width:82vw;background:#0b1220;border:1px solid #1e293b;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.55);overflow:hidden;text-align:left">
        <div style="height:38px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#111a2e;border-bottom:1px solid #1e293b">
          <span style="width:12px;height:12px;border-radius:50%;background:#ef4444"></span>
          <span style="width:12px;height:12px;border-radius:50%;background:#f59e0b"></span>
          <span style="width:12px;height:12px;border-radius:50%;background:#22c55e"></span>
          <span style="margin-left:10px;color:#64748b;font:600 13px system-ui">channel-vault-nas — bash</span>
        </div>
        <pre id="cvn-term-body" style="margin:0;padding:20px 22px;min-height:300px;color:#e2e8f0;font:500 18px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap"></pre>
      </div>`
    );
    const body = document.getElementById("cvn-term-body");
    const caret = '<span style="display:inline-block;width:9px;height:20px;background:#38bdf8;vertical-align:-3px;animation:cvnblink 1s step-end infinite"></span>';
    const typeSpeed = opts.typeSpeed || 26;
    let acc = "";
    for (const line of lines) {
      const isCmd = line.startsWith("$");
      if (isCmd) {
        // type character by character
        const prefix = acc;
        for (let i = 0; i < line.length; i++) {
          body.innerHTML = prefix + line.slice(0, i + 1) + caret;
          await sleep(typeSpeed);
        }
        acc = prefix + line + "\n";
        body.innerHTML = acc + caret;
        await sleep(360);
      } else {
        acc += line + "\n";
        body.innerHTML = acc + caret;
        await sleep(opts.lineDelay || 240);
      }
    }
    body.innerHTML = acc + caret;
  }

  // ---- animated download progress card (language neutral) ----------------
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  }
  async function progressCard(opts) {
    opts = opts || {};
    const seconds = opts.seconds || 26;
    const totalMB = opts.totalMB || 715;
    const title = opts.title || "Queue calibration pass";
    const sub = opts.sub || "Signal Lab · 1080p · h264/aac";
    const card = document.createElement("div");
    Object.assign(card.style, {
      position: "absolute",
      left: (opts.x == null ? 316 : opts.x) + "px",
      top: (opts.y == null ? 632 : opts.y) + "px",
      width: (opts.w == null ? 862 : opts.w) + "px",
      padding: "18px 20px",
      borderRadius: "16px",
      background: "linear-gradient(180deg,#0b1628,#0a1120)",
      border: "1px solid #1f6feb55",
      boxShadow: "0 20px 50px rgba(0,0,0,.5), 0 0 0 1px rgba(56,189,248,.15)",
      color: "#e2e8f0",
      zIndex: "14",
    });
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(56,189,248,.14);display:flex;align-items:center;justify-content:center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 12l5 5 5-5"/><path d="M5 21h14"/></svg>
          </div>
          <div>
            <div style="font:700 17px system-ui;color:#f1f5f9">${title}</div>
            <div style="font:500 13px ui-monospace,Menlo,monospace;color:#7c8aa5">${sub}</div>
          </div>
        </div>
        <div id="cvn-pc-state" style="font:800 13px system-ui;letter-spacing:.08em;color:#38bdf8;padding:5px 12px;border-radius:999px;background:rgba(56,189,248,.12)">DOWNLOADING</div>
      </div>
      <div style="height:12px;border-radius:8px;background:#0f1c30;overflow:hidden;border:1px solid #16233b">
        <div id="cvn-pc-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#0ea5e9,#22d3ee);box-shadow:0 0 14px rgba(34,211,238,.6)"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;font:600 14px ui-monospace,Menlo,monospace;color:#94a3b8">
        <span id="cvn-pc-pct" style="color:#e2e8f0;font-weight:800">0%</span>
        <span id="cvn-pc-bytes">0 / ${totalMB} MB</span>
        <span id="cvn-pc-speed">0.0 MB/s</span>
        <span id="cvn-pc-eta">ETA ${fmtTime(seconds)}</span>
      </div>`;
    root.appendChild(card);
    const bar = card.querySelector("#cvn-pc-bar");
    const pct = card.querySelector("#cvn-pc-pct");
    const bytes = card.querySelector("#cvn-pc-bytes");
    const speed = card.querySelector("#cvn-pc-speed");
    const eta = card.querySelector("#cvn-pc-eta");
    const stateEl = card.querySelector("#cvn-pc-state");
    const t0 = performance.now();
    const durMs = seconds * 1000;
    await new Promise((res) => {
      function step(now) {
        let p = Math.min(1, (now - t0) / durMs);
        // ease a touch so speed reads naturally
        const shown = Math.min(100, Math.round(p * 100));
        bar.style.width = shown + "%";
        pct.textContent = shown + "%";
        bytes.textContent = `${Math.round((shown / 100) * totalMB)} / ${totalMB} MB`;
        const inst = 8 + Math.sin(now / 260) * 2.2 + (p < 0.08 ? -3 : 0);
        speed.textContent = `${Math.max(2, inst).toFixed(1)} MB/s`;
        eta.textContent = "ETA " + fmtTime(seconds * (1 - p));
        if (p < 1) requestAnimationFrame(step);
        else res();
      }
      requestAnimationFrame(step);
    });
    stateEl.textContent = "COMPLETED";
    stateEl.style.color = "#22c55e";
    stateEl.style.background = "rgba(34,197,94,.14)";
    bar.style.background = "linear-gradient(90deg,#16a34a,#22c55e)";
    speed.textContent = "done";
    eta.textContent = "ETA 0:00";
    return card;
  }

  window.__cvn = {
    __installed: true,
    place,
    moveTo,
    moveToSel,
    ripple,
    ringSel,
    clearRing,
    setBadge,
    titleCard,
    endCard,
    terminal,
    hideScrim,
    progressCard,
    sleep,
    centerOf,
    rectOf,
  };
};
