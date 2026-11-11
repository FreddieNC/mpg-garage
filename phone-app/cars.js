/* Vehicle illustrations — hand-drawn SVG side profiles, all facing right.
   carSVG(style, colour) returns an <svg> string. */
(function () {
  let uid = 0;

  function shade(hex, amt) {
    // amt -1..1 : darken (neg) / lighten (pos)
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function wheel(cx, cy, r, id, style) {
    const rim = r * 0.64;
    let spokes = '';
    const n = (style === 'van' || style === 'aero') ? 0 : 5;
    if (style === 'aero') {
      // Prius-style aero wheel cover: flat disc with a ring of short slots
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r1 = rim * 0.5, r2 = rim * 0.86;
        spokes += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="#2a3038" stroke-width="${(rim * 0.16).toFixed(1)}" stroke-linecap="round"/>`;
      }
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a2 = a + 0.32;
      spokes += `<path d="M${cx} ${cy} L${(cx + Math.cos(a) * rim * 0.92).toFixed(1)} ${(cy + Math.sin(a) * rim * 0.92).toFixed(1)} A${rim * 0.92} ${rim * 0.92} 0 0 1 ${(cx + Math.cos(a2) * rim * 0.92).toFixed(1)} ${(cy + Math.sin(a2) * rim * 0.92).toFixed(1)} Z" fill="url(#rimDark${id})" opacity=".85"/>`;
    }
    const steelHoles = style === 'van'
      ? [0, 1, 2, 3, 4, 5].map(i => {
          const a = (i / 6) * Math.PI * 2;
          return `<circle cx="${(cx + Math.cos(a) * rim * 0.62).toFixed(1)}" cy="${(cy + Math.sin(a) * rim * 0.62).toFixed(1)}" r="${(rim * 0.13).toFixed(1)}" fill="#2a2f36"/>`;
        }).join('')
      : '';
    return `
      <g>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#16181c"/>
        <circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="none" stroke="#2c3036" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${rim}" fill="url(#rim${id})"/>
        ${spokes}${steelHoles}
        <circle cx="${cx}" cy="${cy}" r="${rim}" fill="none" stroke="#e9edf2" stroke-opacity=".5" stroke-width="1.2"/>
        <circle cx="${cx}" cy="${cy}" r="${rim * 0.22}" fill="#c9cfd6" stroke="#6b737d" stroke-width="1"/>
      </g>`;
  }

  // Roof crossbars seen side-on: a foot on the roof and the bar's cross-section on top.
  function roofBars(points) {
    return points.map(([x, y]) => `
      <g>
        <path d="M${x - 6} ${y + 1.5} L${x - 4} ${y - 4.5} L${x + 4} ${y - 4.5} L${x + 6} ${y + 1.5} Z" fill="#1b1f25" stroke="#0b0d10" stroke-width=".8"/>
        <rect x="${x - 13}" y="${y - 9}" width="26" height="5" rx="2.5" fill="#2b3139" stroke="#0b0d10" stroke-width=".8"/>
        <path d="M${x - 10} ${y - 7.8} L${x + 10} ${y - 7.8}" stroke="#7d8793" stroke-width="1" stroke-linecap="round" opacity=".8"/>
      </g>`).join('');
  }

  function defs(id, colour) {
    return `
    <defs>
      <linearGradient id="body${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(colour, 0.35)}"/>
        <stop offset=".42" stop-color="${colour}"/>
        <stop offset=".55" stop-color="${shade(colour, -0.12)}"/>
        <stop offset="1" stop-color="${shade(colour, -0.45)}"/>
      </linearGradient>
      <linearGradient id="glass${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#5d7a95"/>
        <stop offset=".5" stop-color="#1e2b38"/>
        <stop offset="1" stop-color="#0f161e"/>
      </linearGradient>
      <linearGradient id="shine${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".5" stop-color="#fff" stop-opacity=".22"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="rim${id}" cx=".4" cy=".35" r=".8">
        <stop offset="0" stop-color="#f4f6f8"/>
        <stop offset=".6" stop-color="#a9b1ba"/>
        <stop offset="1" stop-color="#5f6872"/>
      </radialGradient>
      <radialGradient id="rimDark${id}" cx=".5" cy=".5" r=".6">
        <stop offset="0" stop-color="#3a4048"/>
        <stop offset="1" stop-color="#14171b"/>
      </radialGradient>
      <radialGradient id="shadow${id}" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#000" stop-opacity=".55"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
    </defs>`;
  }

  /* ---------- Individual body styles ---------- */

  // 2nd-gen (2004–09) Prius-style liftback, drawn to real proportions:
  // single arched roofline peaking behind the B-pillar, very raked screen,
  // short sloping bonnet, high cut-off tail with spoiler lip, black B/C pillars,
  // small rear quarter glass and 15" aero wheel covers.
  function liftback(id, c) {
    const dark = shade(c, -0.5);
    const body = `M46 140 Q37 140 35 132 L33 104 Q32 92 34 84 L35 75 Q37 70 43 69
      C100 52 150 36 192 35 C225 34 250 58 284 84 Q332 88 362 98 Q373 104 372 120 L370 132 Q368 140 358 140
      L325.5 140 A30 30 0 1 0 272.5 140 L119.5 140 A30 30 0 1 0 66.5 140 Z`;
    return `
      ${defs(id, c)}
      <ellipse cx="200" cy="150" rx="178" ry="11" fill="url(#shadow${id})"/>
      <!-- wheel wells -->
      <path d="M272.5 140 A30 30 0 1 1 325.5 140 Z" fill="#0a0c0f"/>
      <path d="M66.5 140 A30 30 0 1 1 119.5 140 Z" fill="#0a0c0f"/>
      <path d="${body}" fill="url(#body${id})" stroke="${shade(c, -0.55)}" stroke-width="1.2" stroke-linejoin="round"/>
      <!-- side glass -->
      <path d="M266 81 C247 61 228 48 196 43 C150 43 104 54 60 71 L67 74.5 Z" fill="url(#glass${id})"/>
      <path d="M124 52 C150 45 172 44 188 45 L180 52 C160 52 142 56 130 60 Z" fill="#fff" opacity=".16"/>
      <path d="M232 56 C244 64 252 72 258 80 L248 80 C242 72 236 64 228 58 Z" fill="#fff" opacity=".1"/>
      <!-- blacked-out pillars: front quarter-light, B-pillar, rear quarter divider -->
      <path d="M253 69 L255.5 81" stroke="#0e1319" stroke-width="3" stroke-linecap="round"/>
      <path d="M194 43 L196.5 82" stroke="#0e1319" stroke-width="6"/>
      <path d="M106 54 L101 76" stroke="#0e1319" stroke-width="4"/>
      <!-- spoiler lip & lower vertical rear glass -->
      <path d="M34 76 L64 69" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>
      <path d="M33.5 77 L33.5 83" stroke="#121a23" stroke-width="3.5"/>
      <!-- wrap-around tail lamp -->
      <path d="M34 85 L56 85 Q62 87 60 92 L34 100 Z" fill="#b5121b"/>
      <path d="M36 87 L54 87 Q57 88 56 90 L37 95 Z" fill="#ff6a5c" opacity=".55"/>
      <!-- swept headlamp & projector -->
      <path d="M316 90 Q344 93 366 103 L363 110 Q342 103 318 96 Z" fill="#e8f1f8" stroke="#7c8792" stroke-width=".8"/>
      <circle cx="352" cy="102" r="2.6" fill="#b9c6d2"/>
      <!-- bumper intake & fog lamp -->
      <path d="M346 122 Q358 120 370 122 L369 131 Q358 133 346 131 Z" fill="#1b2026"/>
      <circle cx="338" cy="128" r="2.4" fill="#d6dde4" opacity=".8"/>
      <!-- rising character line -->
      <path d="M270 104 Q180 98 58 91" fill="none" stroke="${shade(c, 0.55)}" stroke-opacity=".7" stroke-width="1.3"/>
      <path d="M270 105.5 Q180 99.5 58 92.5" fill="none" stroke="${shade(c, -0.4)}" stroke-opacity=".45" stroke-width="1"/>
      <path d="M122 128 L268 128" stroke="${shade(c, -0.45)}" stroke-opacity=".5" stroke-width="1"/>
      <!-- door shut lines -->
      <path d="M267 83 L265 116 M196.5 82 L199 136 M101 77 Q104 100 118 112" fill="none" stroke="${dark}" stroke-width="1.1"/>
      <rect x="222" y="94" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <rect x="148" y="92" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <!-- mirror -->
      <path d="M254 77 L272 74 Q277 77 275 83 L259 85 Z" fill="${shade(c, -0.1)}" stroke="${dark}" stroke-width=".8"/>
      ${wheel(93, 126, 24, id, 'aero')}
      ${wheel(299, 126, 24, id, 'aero')}`;
  }

  // Cab-over panel/window van in the spirit of the L300 / Delica
  function van(id, c, opts) {
    const body = `M28 140 L26 44 Q26 30 40 30 L326 30 Q340 30 343 40 L356 86 Q360 92 360 100 L362 132 Q362 140 356 140 L318 140 A32 32 0 0 0 256 140 L136 140 A32 32 0 0 0 72 140 Z`;
    return `
      ${defs(id, c)}
      <ellipse cx="195" cy="150" rx="185" ry="12" fill="url(#shadow${id})"/>
      ${opts.roofBars ? `
      <path d="M60 30 L60 23 M140 30 L140 23 M220 30 L220 23 M300 30 L300 23" stroke="#2b3037" stroke-width="3"/>
      <rect x="48" y="19" width="266" height="5" rx="2" fill="#3a4048"/>
      ` : ""}
      <path d="${body}" fill="url(#body${id})" stroke="${shade(c, -0.55)}" stroke-width="1.2"/>
      <!-- windows -->
      <path d="M272 40 L332 40 Q338 40 340 46 L352 86 L272 86 Z" fill="url(#glass${id})"/>
      <path d="M190 40 L262 40 L262 86 L190 86 Z" fill="url(#glass${id})"/>
      <path d="M106 40 L180 40 L180 86 L106 86 Z" fill="url(#glass${id})"/>
      <path d="M36 40 L96 40 L96 86 L36 86 Q34 86 34 84 L34 44 Q34 40 38 40 Z" fill="url(#glass${id})"/>
      <path d="M282 44 L320 44 L296 70 L282 70 Z" fill="#fff" opacity=".14"/>
      <path d="M196 44 L236 44 L204 72 L196 72 Z" fill="#fff" opacity=".12"/>
      <path d="M112 44 L150 44 L120 72 L112 72 Z" fill="#fff" opacity=".12"/>
      <!-- classic body stripes -->
      <path d="M28 98 L360 98" stroke="#d1462f" stroke-width="5"/>
      <path d="M28 105 L361 105" stroke="#e8a33a" stroke-width="3"/>
      <path d="M28 110 L361 110" stroke="#7a3b22" stroke-width="2"/>
      <!-- door shut lines & sliding door rail -->
      <path d="M268 32 L268 136 M186 32 L186 136 M102 32 L102 136" fill="none" stroke="${shade(c, -0.5)}" stroke-width="1.2"/>
      <path d="M104 92 L262 92" stroke="${shade(c, -0.5)}" stroke-width="2"/>
      <rect x="276" y="114" width="14" height="4" rx="2" fill="${shade(c, -0.45)}"/>
      <rect x="192" y="114" width="12" height="4" rx="2" fill="${shade(c, -0.45)}"/>
      <!-- front face -->
      <path d="M354 92 L362 92 L362 104 L355 104 Z" fill="#f4d58a" stroke="#8f7a40" stroke-width=".8"/>
      <path d="M352 112 L362 112 L362 124 L352 124 Z" fill="#e8f1f8" stroke="#7c8792" stroke-width=".8"/>
      <path d="M340 130 L364 130 L364 140 L340 140 Z" fill="#2a2f36"/>
      <!-- mirror arm -->
      <path d="M352 62 L366 58 L368 76 L358 78 Z" fill="#2a2f36"/>
      <!-- rear light -->
      <path d="M27 92 L33 92 L33 124 L27 124 Z" fill="#c4161c"/>
      <path d="M26 132 L60 132 L60 140 L28 140 Z" fill="#2a2f36"/>
      ${wheel(104, 140, 28, id, 'van')}
      ${wheel(287, 140, 28, id, 'van')}`;
  }

  function hatchback(id, c) {
    const body = `M48 140 L46 104 Q46 92 56 86 L92 58 Q104 50 124 48 L208 48 Q226 48 238 58 L268 82 Q330 88 352 100 Q364 108 362 126 L358 140 L326 140 A33 33 0 0 0 262 140 L140 140 A33 33 0 0 0 74 140 Z`;
    return `
      ${defs(id, c)}
      <ellipse cx="205" cy="150" rx="180" ry="12" fill="url(#shadow${id})"/>
      <path d="${body}" fill="url(#body${id})" stroke="${shade(c, -0.55)}" stroke-width="1.2"/>
      <path d="M66 86 L98 60 Q108 54 124 54 L206 54 Q220 54 230 62 L256 84 Z" fill="url(#glass${id})"/>
      <path d="M100 62 Q112 56 150 56 L132 76 L96 78 Z" fill="#fff" opacity=".16"/>
      <path d="M152 85 L156 52" stroke="url(#body${id})" stroke-width="7"/>
      <path d="M86 86 L104 56" stroke="url(#body${id})" stroke-width="9"/>
      <path d="M48 92 L56 90 L58 110 L48 112 Z" fill="#c4161c"/>
      <path d="M330 94 Q348 98 360 106 L356 112 Q340 108 328 102 Z" fill="#e8f1f8" stroke="#7c8792" stroke-width=".8"/>
      <path d="M342 126 L362 124 L360 134 L340 134 Z" fill="#20252b"/>
      <path d="M58 104 Q200 96 330 100" fill="none" stroke="${shade(c, 0.5)}" stroke-opacity=".6" stroke-width="1.4"/>
      <path d="M154 86 L152 138 M262 84 Q270 108 268 130" fill="none" stroke="${shade(c, -0.5)}" stroke-width="1.1"/>
      <rect x="176" y="104" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <path d="M244 80 L258 78 L260 86 L248 88 Z" fill="${shade(c, -0.15)}"/>
      ${wheel(107, 140, 28, id)}
      ${wheel(294, 140, 28, id)}`;
  }

  function saloon(id, c) {
    const body = `M30 140 L28 112 Q28 100 40 98 L96 90 L132 60 Q144 50 164 50 L234 50 Q252 50 266 62 L292 86 Q346 92 370 104 Q380 112 378 128 L374 140 L340 140 A33 33 0 0 0 276 140 L136 140 A33 33 0 0 0 70 140 Z`;
    return `
      ${defs(id, c)}
      <ellipse cx="205" cy="150" rx="190" ry="12" fill="url(#shadow${id})"/>
      <path d="${body}" fill="url(#body${id})" stroke="${shade(c, -0.55)}" stroke-width="1.2"/>
      <path d="M108 90 L138 64 Q148 56 166 56 L232 56 Q248 56 258 66 L282 88 Z" fill="url(#glass${id})"/>
      <path d="M140 66 Q150 58 186 58 L166 78 L132 80 Z" fill="#fff" opacity=".16"/>
      <path d="M200 89 L202 54" stroke="url(#body${id})" stroke-width="7"/>
      <path d="M30 102 L44 100 L44 114 L30 116 Z" fill="#c4161c"/>
      <path d="M346 98 Q362 102 374 110 L370 116 Q356 112 344 106 Z" fill="#e8f1f8" stroke="#7c8792" stroke-width=".8"/>
      <path d="M356 128 L376 126 L374 136 L354 136 Z" fill="#20252b"/>
      <path d="M40 106 Q200 98 346 104" fill="none" stroke="${shade(c, 0.5)}" stroke-opacity=".6" stroke-width="1.4"/>
      <path d="M202 90 L204 138 M126 92 L130 138 M288 88 Q296 110 294 130" fill="none" stroke="${shade(c, -0.5)}" stroke-width="1.1"/>
      <rect x="160" y="106" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <rect x="236" y="106" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <path d="M268 84 L282 82 L284 90 L272 92 Z" fill="${shade(c, -0.15)}"/>
      ${wheel(103, 140, 28, id)}
      ${wheel(308, 140, 28, id)}`;
  }

  function suv(id, c) {
    const body = `M36 138 L34 62 Q34 40 52 38 L238 36 Q256 36 268 48 L296 78 Q350 84 368 96 Q376 104 374 126 L370 138 L336 138 A36 36 0 0 0 266 138 L140 138 A36 36 0 0 0 70 138 Z`;
    return `
      ${defs(id, c)}
      <ellipse cx="205" cy="150" rx="190" ry="12" fill="url(#shadow${id})"/>
      <path d="${body}" fill="url(#body${id})" stroke="${shade(c, -0.55)}" stroke-width="1.2"/>
      <path d="M44 80 L46 52 Q46 46 54 46 L236 44 Q250 44 258 54 L284 82 Z" fill="url(#glass${id})"/>
      <path d="M60 50 L120 48 L92 72 L56 74 Z" fill="#fff" opacity=".14"/>
      <path d="M104 82 L106 46 M188 82 L190 44" stroke="url(#body${id})" stroke-width="8"/>
      <path d="M35 64 L44 64 L44 92 L35 92 Z" fill="#c4161c"/>
      <path d="M344 90 Q360 94 372 102 L368 110 Q352 106 342 100 Z" fill="#e8f1f8" stroke="#7c8792" stroke-width=".8"/>
      <path d="M350 122 L374 120 L372 134 L348 134 Z" fill="#20252b"/>
      <path d="M36 118 L370 118 L370 128 L36 128 Z" fill="#2a2f36" opacity=".55"/>
      <path d="M190 82 L192 116 M106 82 L108 116 M290 80 Q298 98 298 114" fill="none" stroke="${shade(c, -0.5)}" stroke-width="1.1"/>
      <rect x="140" y="92" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <rect x="226" y="92" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <path d="M270 76 L286 74 L288 84 L274 86 Z" fill="${shade(c, -0.15)}"/>
      ${wheel(105, 138, 32, id)}
      ${wheel(301, 138, 32, id)}`;
  }

  function pickup(id, c) {
    const body = `M24 138 L24 84 L176 84 L178 50 Q180 40 192 40 L250 40 Q262 40 270 50 L296 80 Q350 84 368 96 Q376 104 374 126 L370 138 L334 138 A34 34 0 0 0 266 138 L134 138 A34 34 0 0 0 66 138 Z`;
    return `
      ${defs(id, c)}
      <ellipse cx="200" cy="150" rx="190" ry="12" fill="url(#shadow${id})"/>
      <path d="${body}" fill="url(#body${id})" stroke="${shade(c, -0.55)}" stroke-width="1.2"/>
      <path d="M186 80 L186 52 Q186 46 194 46 L248 46 Q258 46 264 54 L286 80 Z" fill="url(#glass${id})"/>
      <path d="M194 50 L226 48 L204 70 L192 70 Z" fill="#fff" opacity=".14"/>
      <path d="M24 84 L176 84" stroke="${shade(c, -0.6)}" stroke-width="2"/>
      <path d="M176 84 L176 136 M290 80 Q298 100 298 116" fill="none" stroke="${shade(c, -0.5)}" stroke-width="1.1"/>
      <path d="M24 90 L32 90 L32 112 L24 112 Z" fill="#c4161c"/>
      <path d="M344 90 Q360 94 372 102 L368 110 Q352 106 342 100 Z" fill="#e8f1f8" stroke="#7c8792" stroke-width=".8"/>
      <path d="M350 122 L374 120 L372 134 L348 134 Z" fill="#20252b"/>
      <rect x="216" y="92" width="14" height="3" rx="1.5" fill="${shade(c, -0.4)}"/>
      <path d="M272 76 L288 74 L290 84 L276 86 Z" fill="${shade(c, -0.15)}"/>
      ${wheel(100, 138, 30, id)}
      ${wheel(300, 138, 30, id)}`;
  }

  const STYLES = {
    liftback: { label: "Liftback (Prius-style)", draw: liftback, bars: [[138, 43], [211, 37.5]] },
    van: { label: "Cab-over van (L300-style)", draw: van, bars: null },
    hatchback: { label: "Hatchback", draw: hatchback, bars: [[136, 48], [200, 48]] },
    saloon: { label: "Saloon / sedan", draw: saloon, bars: [[172, 50], [228, 50]] },
    suv: { label: "SUV / 4x4", draw: suv, bars: [[92, 38.5], [222, 36.5]] },
    pickup: { label: "Pickup", draw: pickup, bars: [[200, 40], [244, 40]] },
  };

  window.CAR_STYLES = STYLES;
  window.carSVG = function (style, colour, opts) {
    opts = opts || {};
    const s = STYLES[style] || STYLES.hatchback;
    const id = 'c' + (++uid);
    return `<svg class="car-svg" viewBox="0 0 400 165" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s.draw(id, colour || "#9aa3ad", opts)}${opts.roofBars && s.bars ? roofBars(s.bars) : ""}</svg>`;
  };
})();
