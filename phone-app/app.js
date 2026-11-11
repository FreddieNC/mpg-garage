/* MPG Garage — app logic */
(function () {
  'use strict';

  /* ================= Units ================= */
  const KM_PER_MI = 1.609344;
  const L_PER_UKGAL = 4.54609;
  const L_PER_USGAL = 3.785411784;

  const EFF = {
    'uk-mpg': { label: 'UK mpg', unit: 'mpg', calc: (km, l) => (km / KM_PER_MI) / (l / L_PER_UKGAL), higher: true, dist: 'mi' },
    'us-mpg': { label: 'US mpg', unit: 'mpg', calc: (km, l) => (km / KM_PER_MI) / (l / L_PER_USGAL), higher: true, dist: 'mi' },
    'kmpl':   { label: 'km/L',   unit: 'km/L', calc: (km, l) => km / l, higher: true, dist: 'km' },
    'l100':   { label: 'L/100km', unit: 'L/100km', calc: (km, l) => (l / km) * 100, higher: false, dist: 'km' },
  };
  const DIST = { mi: { label: 'miles', short: 'mi', toKm: v => v * KM_PER_MI, fromKm: v => v / KM_PER_MI },
                 km: { label: 'km', short: 'km', toKm: v => v, fromKm: v => v } };
  const FUEL = { L: { label: 'litres', short: 'L', toL: v => v, fromL: v => v },
                 ukgal: { label: 'UK gallons', short: 'UK gal', toL: v => v * L_PER_UKGAL, fromL: v => v / L_PER_UKGAL },
                 usgal: { label: 'US gallons', short: 'US gal', toL: v => v * L_PER_USGAL, fromL: v => v / L_PER_USGAL } };

  const COLOURS = ['#b9c0c8', '#f1f1ee', '#1e1f22', '#c8202f', '#1f4fa8', '#2f7d4f', '#e8a33a', '#6a3fa0', '#8a6a4b', '#3fa9c9'];
  const FUEL_TYPES = ['Petrol', 'Diesel', 'Petrol hybrid', 'Diesel hybrid', 'Plug-in hybrid', 'LPG', 'Other'];

  /* ================= Storage ================= */
  const STORE_KEY = 'mpg-garage-v1';
  const isNative = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bridge);

  function seed() {
    return {
      version: 1,
      prefs: { eff: 'uk-mpg', dist: 'mi', fuel: 'L', currency: '£', costCur: 'NZD' },
      vehicles: [
        { id: 'prius', make: 'Toyota', model: 'Prius', year: '2007', reg: '', fuel: 'Petrol hybrid', style: 'liftback', color: '#b9c0c8', photo: null, roofBars: true },
        { id: 'l300', make: 'Mitsubishi', model: 'L300', year: '', reg: '', fuel: 'Diesel', style: 'van', color: '#f1f1ee', photo: null, roofBars: true },
      ],
      entries: [],
      rates: {},
    };
  }

  function load() {
    let raw = null;
    if (typeof window.__NATIVE_DATA__ === 'string' && window.__NATIVE_DATA__.trim()) raw = window.__NATIVE_DATA__;
    if (!raw) { try { raw = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ } }
    if (raw) {
      try { const d = normalize(JSON.parse(raw)); if (d) return d; } catch (e) { /* fall through to seed */ }
    }
    return seed();
  }

  // Fill in defaults / migrate older data. Returns null if it isn't MPG Garage data.
  function normalize(d) {
    if (!d || !Array.isArray(d.vehicles)) return null;
    d.prefs = Object.assign(seed().prefs, d.prefs || {});
    d.entries = Array.isArray(d.entries) ? d.entries : [];
    d.rates = d.rates || {};
    // v2: roof bars option — the Prius gets bars, the L300 keeps the rack it always had
    d.vehicles.forEach(v => { if (v.roofBars === undefined) v.roofBars = (v.id === 'prius' || v.id === 'l300'); });
    return d;
  }

  let state = load();
  let view = state.vehicles.length ? 'garage' : 'garage';

  function save() {
    const json = JSON.stringify(state);
    if (isNative) {
      try { window.webkit.messageHandlers.bridge.postMessage(JSON.stringify({ type: 'save', data: json })); } catch (e) { /* ignore */ }
    }
    try { localStorage.setItem(STORE_KEY, json); } catch (e) { /* ignore */ }
  }

  /* ================= Helpers ================= */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const num = v => { const n = parseFloat(String(v || '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : NaN; };
  const fmt = (n, dp = 1) => isFinite(n) ? n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—';
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const niceDate = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const shortDate = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

  const effUnit = () => EFF[state.prefs.eff];
  const effOf = (km, l) => (km > 0 && l > 0) ? effUnit().calc(km, l) : NaN;
  const vName = v => [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unnamed vehicle';
  const vById = id => state.vehicles.find(v => v.id === id);
  const entriesFor = id => state.entries.filter(e => e.vehicleId === id)
    .sort((a, b) => (a.date === b.date ? (a.created || 0) - (b.created || 0) : a.date < b.date ? -1 : 1));

  function stats(id) {
    const es = entriesFor(id);
    const km = es.reduce((s, e) => s + e.km, 0);
    const l = es.reduce((s, e) => s + e.litres, 0);
    const costs = es.filter(e => e.cost > 0);
    const cost = costs.reduce((s, e) => s + e.cost, 0);
    const costKm = costs.reduce((s, e) => s + e.km, 0);
    const costL = costs.reduce((s, e) => s + e.litres, 0);
    const effs = es.map(e => effOf(e.km, e.litres));
    const better = effUnit().higher ? Math.max : Math.min;
    const worse = effUnit().higher ? Math.min : Math.max;
    return {
      count: es.length, km, l, cost, entries: es, effs,
      avg: effOf(km, l),
      best: effs.length ? better(...effs) : NaN,
      worst: effs.length ? worse(...effs) : NaN,
      latest: effs.length ? effs[effs.length - 1] : NaN,
      costPerDist: costKm > 0 ? cost / DIST[effUnit().dist].fromKm(costKm) : NaN,
      pricePerUnit: costL > 0 ? cost / FUEL[state.prefs.fuel].fromL(costL) : NaN,
    };
  }

  function vehicleVisual(v, cls = '') {
    if (v.photo) return `<img class="photo ${cls}" src="${v.photo}" alt="">`;
    return `<div class="car-wrap">${window.carSVG(v.style, v.color, { roofBars: v.roofBars })}</div>`;
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200);
  }

  /* ================= Sidebar ================= */
  function renderSidebar() {
    $('#vehicleList').innerHTML = state.vehicles.map(v => {
      const s = stats(v.id);
      const thumb = v.photo ? `<img src="${v.photo}" alt="">` : window.carSVG(v.style, v.color, { roofBars: v.roofBars });
      return `<button class="v-item ${view === 'vehicle:' + v.id ? 'active' : ''}" data-go="vehicle:${v.id}">
        <span class="v-thumb">${thumb}</span>
        <span style="min-width:0"><div class="v-name">${esc(vName(v))}</div>
        <div class="v-meta">${s.count ? fmt(s.avg) + ' ' + esc(effUnit().unit) : 'No fill-ups yet'}</div></span>
      </button>`;
    }).join('');
    $('#navGarage').classList.toggle('active', view === 'garage');
    $('#navCalc').classList.toggle('active', view === 'calc');
    $('#navSettings').classList.toggle('active', view === 'settings');
    $('#tabGarage').classList.toggle('active', view === 'garage' || view.startsWith('vehicle:'));
    $('#tabCalc').classList.toggle('active', view === 'calc');
    $('#tabSettings').classList.toggle('active', view === 'settings');
    $('#unitPill').textContent = effUnit().label;
    $$('.unit-switch button').forEach(b => b.classList.toggle('active', b.dataset.unit === state.prefs.eff));
  }

  /* ================= Settings & backup ================= */
  function renderSettings() {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    return `
      <div class="page-head"><div><h1>Settings &amp; backup</h1><p>Units, plus moving your data between your Mac and phone.</p></div></div>
      <div class="settings">
        <div class="panel">
          <h2>Show economy as</h2>
          <div class="unit-switch">${Object.keys(EFF).map(k => `<button data-unit="${k}">${EFF[k].label}</button>`).join('')}</div>
        </div>
        <div class="panel">
          <h2>Backup &amp; restore</h2>
          <p>Each device keeps its own copy of your garage. Export a backup file on one device, then import it on the other — by email, Google Drive, AirDrop or a USB cable.</p>
          <div class="actions">
            <button class="btn primary" data-action="export">⇪ Export backup</button>
            <button class="btn" data-action="import">⇩ Import backup…</button>
          </div>
          <div class="small">${state.vehicles.length} vehicle${state.vehicles.length === 1 ? '' : 's'} · ${state.entries.length} fill-up${state.entries.length === 1 ? '' : 's'} on this device. Importing lets you <b>merge</b> (keep everything from both) or <b>replace</b>.</div>
        </div>
        ${!isNative && !standalone ? `<div class="panel" id="installPanel">
          <h2>Install on your phone</h2>
          <p>In Chrome on Android, open the menu <b>⋮</b> and tap <b>Add to Home screen</b> (or <b>Install app</b>). MPG Garage then opens full-screen from its own icon and works offline.</p>
          <button class="btn primary" data-action="install" id="installBtn" ${deferredInstall ? '' : 'hidden'}>Install MPG Garage</button>
        </div>` : ''}
      </div>`;
  }

  function exportData() {
    const json = JSON.stringify(state);
    const name = `mpg-garage-backup-${today()}.json`;
    if (isNative) { window.webkit.messageHandlers.bridge.postMessage(JSON.stringify({ type: 'exportData', data: json, name })); return; }
    const file = new File([json], name, { type: 'application/json' });
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'MPG Garage backup' }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Backup saved to Downloads');
    }
  }

  function importData() {
    if (isNative) window.webkit.messageHandlers.bridge.postMessage(JSON.stringify({ type: 'importData' }));
    else $('#importInput').click();
  }
  $('#importInput').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader(); r.onload = () => window.__importData(String(r.result)); r.readAsText(file);
    e.target.value = '';
  });

  // Called with the backup file's text (by the file input, or by the Mac app's open panel)
  window.__importData = function (text) {
    let d = null;
    try { d = normalize(JSON.parse(text)); } catch (e) { /* invalid */ }
    if (!d) { toast("That file isn't an MPG Garage backup"); return; }
    openModal('Import backup', `
      <p style="color:var(--ink-2);margin:0 0 8px">This backup has <b>${d.vehicles.length} vehicle${d.vehicles.length === 1 ? '' : 's'}</b> and <b>${d.entries.length} fill-up${d.entries.length === 1 ? '' : 's'}</b>.</p>
      <p style="color:var(--ink-3);margin:0 0 18px;font-size:13px"><b>Merge</b> adds anything new and updates matching records, keeping everything already on this device.<br><b>Replace</b> wipes this device's garage and uses the backup instead.</p>
      <div class="modal-actions"><button class="btn danger" id="impReplace">Replace all</button>
        <div class="right"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="impMerge">Merge</button></div></div>`);
    $('#impMerge').onclick = () => {
      const upsert = (list, items) => items.forEach(x => { const i = list.findIndex(y => y.id === x.id); if (i >= 0) list[i] = x; else list.push(x); });
      upsert(state.vehicles, d.vehicles); upsert(state.entries, d.entries);
      Object.assign(state.rates, d.rates);
      save(); closeModal(); render(); toast('Backup merged');
    };
    $('#impReplace').onclick = () => { state = d; save(); closeModal(); go('garage'); toast('Garage replaced from backup'); };
  };

  /* ---- Installable app (Android / Chrome) ---- */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredInstall = e;
    const b = $('#installBtn'); if (b) b.hidden = false;
  });
  if (!isNative && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    // ask the browser not to clear our saved data when space runs low
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  /* ================= Garage view ================= */
  function renderGarage() {
    const total = state.entries.length;
    return `
      <div class="page-head">
        <div><h1>My garage</h1><p>${state.vehicles.length} vehicle${state.vehicles.length === 1 ? '' : 's'} · ${total} fill-up${total === 1 ? '' : 's'} logged</p></div>
        <button class="btn primary" data-action="add-vehicle">＋ Add vehicle</button>
      </div>
      <div class="garage-grid">
        ${state.vehicles.map(v => {
          const s = stats(v.id);
          const d = DIST[effUnit().dist];
          return `<article class="car-card" data-go="vehicle:${v.id}">
            <div class="stage card-stage ${v.photo ? 'has-photo' : ''}">
              ${v.reg ? `<span class="plate">${esc(v.reg.toUpperCase())}</span>` : ''}
              ${vehicleVisual(v)}
            </div>
            <div class="card-body">
              <div class="card-title"><h3>${esc(vName(v))}</h3><span class="sub">${esc(v.fuel || '')}</span></div>
              <div class="card-stats">
                <div class="mini-stat big"><div class="k">Average</div><div class="v">${fmt(s.avg)}<span class="u">${esc(effUnit().unit)}</span></div></div>
                <div class="mini-stat"><div class="k">Fill-ups</div><div class="v">${s.count}</div></div>
                <div class="mini-stat"><div class="k">Distance</div><div class="v">${fmt(d.fromKm(s.km), 0)}<span class="u">${d.short}</span></div></div>
              </div>
            </div>
          </article>`;
        }).join('')}
        <button class="add-card" data-action="add-vehicle"><span><span class="plus">＋</span>Add a vehicle</span></button>
      </div>`;
  }

  /* ================= Gauge ================= */
  function gaugeSVG(km, l) {
    // Position needle on a common scale (UK mpg 0–80) so "better" is always to the right.
    const ukmpg = (km > 0 && l > 0) ? EFF['uk-mpg'].calc(km, l) : NaN;
    const frac = isFinite(ukmpg) ? Math.max(0, Math.min(1, ukmpg / 80)) : 0;
    const a = Math.PI * (1 - frac);
    const cx = 130, cy = 120, r = 96;
    const nx = cx + Math.cos(a) * (r - 16), ny = cy - Math.sin(a) * (r - 16);
    const ticks = [];
    for (let i = 0; i <= 16; i++) {
      const t = Math.PI * (1 - i / 16), big = i % 4 === 0;
      const r1 = r + 8, r2 = big ? r + 18 : r + 13;
      ticks.push(`<line x1="${cx + Math.cos(t) * r1}" y1="${cy - Math.sin(t) * r1}" x2="${cx + Math.cos(t) * r2}" y2="${cy - Math.sin(t) * r2}" stroke="${big ? '#6f7b8c' : '#3a4452'}" stroke-width="${big ? 2 : 1.4}" stroke-linecap="round"/>`);
    }
    const val = effOf(km, l);
    return `<svg class="gauge" viewBox="0 0 260 172" aria-label="Average economy gauge">
      <defs><linearGradient id="gArc" x1="0" x2="1"><stop offset="0" stop-color="#ff5d6c"/><stop offset=".45" stop-color="#ffb347"/><stop offset="1" stop-color="#3ccf8e"/></linearGradient></defs>
      <path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#232a35" stroke-width="14" stroke-linecap="round"/>
      <path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="url(#gArc)" stroke-width="14" stroke-linecap="round" pathLength="100" stroke-dasharray="${(frac * 100).toFixed(1)} 200" style="transition:stroke-dasharray .6s"/>
      ${ticks.join('')}
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#eef2f7" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="8" fill="#eef2f7"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="#171c24"/>
      <text x="${cx}" y="${cy + 30}" text-anchor="middle" fill="#eef2f7" font-size="26" font-weight="800">${fmt(val)}</text>
      <text x="${cx}" y="${cy + 46}" text-anchor="middle" fill="#6f7b8c" font-size="11.5" font-weight="600">AVERAGE ${esc(effUnit().label.toUpperCase())}</text>
    </svg>`;
  }

  /* ================= Vehicle view ================= */
  const ICON = {
    avg: '<svg viewBox="0 0 24 24"><path d="M4 18a8 8 0 1 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 18l4-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    best: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    road: '<svg viewBox="0 0 24 24"><path d="M8 3L4 21M16 3l4 18M12 4v3M12 10v3M12 16v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    pump: '<svg viewBox="0 0 24 24"><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M7 8h6M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cash: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  function segHTML(name, opts, active) {
    return `<div class="seg" data-seg="${name}">${Object.keys(opts).map(k => `<button type="button" data-val="${k}" class="${k === active ? 'active' : ''}">${opts[k].short}</button>`).join('')}</div>`;
  }

  function resultStrip(km, l) {
    return `<div class="result-strip">${Object.keys(EFF).map(k => {
      const v = (km > 0 && l > 0) ? EFF[k].calc(km, l) : NaN;
      return `<div class="r ${k === state.prefs.eff ? 'active' : ''}"><div class="v">${fmt(v)}</div><div class="k">${EFF[k].label}</div></div>`;
    }).join('')}</div>`;
  }

  function fuelForm(opts) {
    const p = state.prefs;
    return `
      ${opts.withDate ? `<div class="field"><label>Date</label><input class="input" type="date" name="date" value="${today()}"></div>` : ''}
      ${opts.withCost ? `<div class="field"><label>Odometer reading <span style="color:var(--ink-3);font-weight:500">optional · current mileage</span></label>
        <div class="input-unit"><input name="odo" inputmode="decimal" placeholder="e.g. 123456" autocomplete="off"><span class="unit-suffix odo-unit">${DIST[p.dist].short}</span></div>
        <div class="odo-hint"></div>
      </div>` : ''}
      <div class="field"><label>Distance driven <span class="auto-tag">from odometer</span></label>
        <div class="input-unit"><input name="distance" inputmode="decimal" placeholder="e.g. 412.5" autocomplete="off">${segHTML('dist', DIST, p.dist)}</div>
      </div>
      ${opts.withCost ? `<div class="trio">
        <div class="trio-head"><b>Fuel &amp; cost</b><span>Fill in any two — the third is worked out</span></div>` : ''}
      <div class="field"><label>Fuel used <span class="auto-tag">calculated</span></label>
        <div class="input-unit"><input name="fuel" inputmode="decimal" placeholder="e.g. 38.2" autocomplete="off">${segHTML('fuel', FUEL, p.fuel)}</div>
      </div>
      ${opts.withCost ? `<div class="field"><label>Total cost <span class="auto-tag">calculated</span></label>
        <div class="input-unit"><input name="cost" inputmode="decimal" placeholder="e.g. 95.40" autocomplete="off">
          <select name="costCur" class="cur-select" aria-label="Currency">${Object.keys(CURRENCIES).map(c => `<option value="${c}" ${c === p.costCur ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label><span class="price-label">${priceLabel()}</span> <span class="auto-tag">calculated</span></label>
        <div class="input-unit"><input name="price" inputmode="decimal" placeholder="e.g. 2.799" autocomplete="off"><span class="unit-suffix">${priceSuffix()}</span></div>
      </div>
      <div class="fx"></div>
      <div class="trio-foot">Costs are saved in UK pounds.</div>
      </div>` : ''}`;
  }

  /* ---- Fuel / total cost / price: enter any two, the third is calculated ---- */
  const TRIO = ['fuel', 'cost', 'price'];
  const fuelUnitWord = () => ({ L: 'litre', ukgal: 'UK gallon', usgal: 'US gallon' }[state.prefs.fuel]);
  const priceLabel = () => `Price per ${fuelUnitWord()}`;
  const priceSuffix = () => `${state.prefs.costCur || 'GBP'} / ${FUEL[state.prefs.fuel].short}`;

  function updatePriceUnit(form) {
    if (!form || !form.price) return;
    form.querySelector('.price-label').textContent = priceLabel();
    form.querySelector('.unit-suffix').textContent = `${form.costCur.value} / ${FUEL[state.prefs.fuel].short}`;
  }

  // `changed` = the field the user just typed in (null = just recompute)
  function solveTrio(form, changed) {
    if (!form || !form.price) return;
    let order = JSON.parse(form.dataset.order || '[]');
    if (changed) {
      order = order.filter(n => n !== changed);
      if (form[changed].value.trim() !== '') order.push(changed);
    }
    form.dataset.order = JSON.stringify(order);
    const recent = order.slice(-2);
    const target = recent.length === 2 ? TRIO.find(n => !recent.includes(n)) : null;
    const fuel = num(form.fuel.value), cost = num(form.cost.value), price = num(form.price.value);
    TRIO.forEach(n => {
      const wrap = form[n].closest('.field');
      if (n === target) {
        let v = NaN;
        if (n === 'fuel') v = price > 0 ? cost / price : NaN;
        else if (n === 'cost') v = fuel * price;
        else v = fuel > 0 ? cost / fuel : NaN;
        form[n].value = isFinite(v) && v > 0 ? v.toFixed(n === 'price' ? 3 : 2) : '';
        wrap.classList.add('is-auto');
      } else if (wrap.classList.contains('is-auto')) {
        wrap.classList.remove('is-auto');
        if (!order.includes(n)) form[n].value = '';
      }
    });
  }

  /* ================= Currency ================= */
  // Costs are always stored in GBP. Foreign amounts are converted with the
  // European Central Bank reference rate for the fill-up date (via frankfurter.dev),
  // cached in the data file so it keeps working offline; the rate can be overridden.
  const CURRENCIES = {
    GBP: { sym: '£', name: 'British pound' }, NZD: { sym: 'NZ$', name: 'New Zealand dollar' },
    AUD: { sym: 'A$', name: 'Australian dollar' }, EUR: { sym: '€', name: 'Euro' },
    USD: { sym: 'US$', name: 'US dollar' }, CAD: { sym: 'C$', name: 'Canadian dollar' },
    JPY: { sym: '¥', name: 'Japanese yen' }, CHF: { sym: 'CHF ', name: 'Swiss franc' },
    SEK: { sym: 'kr ', name: 'Swedish krona' }, NOK: { sym: 'kr ', name: 'Norwegian krone' },
    DKK: { sym: 'kr ', name: 'Danish krone' }, SGD: { sym: 'S$', name: 'Singapore dollar' },
    HKD: { sym: 'HK$', name: 'Hong Kong dollar' }, ZAR: { sym: 'R', name: 'South African rand' },
    THB: { sym: '฿', name: 'Thai baht' }, MYR: { sym: 'RM', name: 'Malaysian ringgit' },
    IDR: { sym: 'Rp', name: 'Indonesian rupiah' }, PHP: { sym: '₱', name: 'Philippine peso' },
    INR: { sym: '₹', name: 'Indian rupee' }, CNY: { sym: 'CN¥', name: 'Chinese yuan' },
    KRW: { sym: '₩', name: 'South Korean won' }, MXN: { sym: 'MX$', name: 'Mexican peso' },
    BRL: { sym: 'R$', name: 'Brazilian real' }, PLN: { sym: 'zł', name: 'Polish złoty' },
    CZK: { sym: 'Kč ', name: 'Czech koruna' }, HUF: { sym: 'Ft ', name: 'Hungarian forint' },
    TRY: { sym: '₺', name: 'Turkish lira' }, ISK: { sym: 'kr ', name: 'Icelandic króna' },
    ILS: { sym: '₪', name: 'Israeli shekel' }, RON: { sym: 'lei ', name: 'Romanian leu' },
  };
  const money = (amt, cur) => (CURRENCIES[cur] ? CURRENCIES[cur].sym : cur + ' ') + fmt(amt, 2);
  const pending = {};

  function cachedRate(cur, date) {
    const hit = state.rates[cur + ':' + date];
    if (hit) return { rate: hit.rate, note: `ECB rate for ${shortDate(hit.date)}` };
    // offline fallback: most recent rate we have for this currency
    const keys = Object.keys(state.rates).filter(k => k.startsWith(cur + ':')).sort();
    if (keys.length) { const r = state.rates[keys[keys.length - 1]]; return { rate: r.rate, note: `last known rate (${shortDate(r.date)})`, stale: true }; }
    return null;
  }

  function fetchRate(cur, date) {
    const key = cur + ':' + date;
    if (pending[key]) return pending[key];
    const when = date >= today() ? 'latest' : date;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    pending[key] = fetch(`https://api.frankfurter.dev/v1/${when}?from=${cur}&to=GBP`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => {
        const rate = j && j.rates && j.rates.GBP;
        if (!(rate > 0)) throw new Error('no rate');
        state.rates[key] = { rate, date: j.date }; save();
        return rate;
      })
      .finally(() => { clearTimeout(t); delete pending[key]; });
    return pending[key];
  }

  function updateFx(form) {
    const line = form && form.querySelector(".fx"); if (!line) return;
    const cur = form.costCur.value;
    const amt = num(form.cost.value);
    if (cur === 'GBP') { line.innerHTML = ''; return; }
    const date = (form.date && form.date.value) || today();
    const rateInput = line.querySelector('[name=rate]');
    const userRate = form.dataset.rateEdited === cur + date ? num(rateInput ? rateInput.value : form.dataset.presetRate) : NaN;
    const known = cachedRate(cur, date);
    const exact = state.rates[cur + ':' + date];
    const rate = userRate > 0 ? userRate : known ? known.rate : NaN;
    const note = userRate > 0 ? (+form.dataset.presetRate === userRate ? 'rate saved with this fill-up' : 'your rate') : known ? known.note : '';

    const gbp = amt > 0 && rate > 0 ? `<b>≈ ${money(amt * rate, 'GBP')}</b>` : '';
    const focused = document.activeElement && document.activeElement.name === 'rate';
    if (!focused) {
      line.innerHTML = `${gbp}<span>1 ${cur} =</span><input name="rate" class="rate-input" inputmode="decimal" value="${rate > 0 ? rate : ''}" placeholder="rate">
        <span>GBP</span><span class="fx-note" id="fxNote">${esc(note)}</span>`;
    } else {
      const b = line.querySelector('b'); if (b) b.outerHTML = gbp || '<b></b>'; else if (gbp) line.insertAdjacentHTML('afterbegin', gbp);
      line.querySelector('#fxNote').textContent = note;
    }
    if (!exact && !(userRate > 0)) {
      if (!focused) line.querySelector('#fxNote').textContent = known ? note + ' · fetching today’s…' : 'fetching rate…';
      fetchRate(cur, date).then(() => updateFx(form)).catch(() => {
        const n = line.querySelector('#fxNote');
        if (n) n.textContent = known ? known.note + ' · offline' : 'offline — type the rate in';
      });
    }
  }

  function readCost(form) {
    const amt = num(form.cost.value);
    if (!(amt > 0)) return { cost: 0 };
    const cur = form.costCur.value;
    if (cur === 'GBP') return { cost: amt };
    const rate = num((form.querySelector('[name=rate]') || {}).value);
    if (!(rate > 0)) return { error: `Need an exchange rate for ${cur} → GBP` };
    return { cost: amt * rate, costOrig: amt, costCur: cur, fxRate: rate };
  }

  function readFuelForm(form) {
    const dist = num(form.querySelector('[name=distance]').value);
    const fuel = num(form.querySelector('[name=fuel]').value);
    const km = dist > 0 ? DIST[state.prefs.dist].toKm(dist) : NaN;
    const l = fuel > 0 ? FUEL[state.prefs.fuel].toL(fuel) : NaN;
    return { km, l };
  }

  /* ---- Odometer: enter the current mileage and the distance is worked out
     from the previous fill-up that has a reading ---- */
  function prevOdo(vid, date, excludeId) {
    // latest reading on or before this date (excluding the entry being edited)
    const list = state.entries.filter(e => e.vehicleId === vid && e.odo > 0 && e.id !== excludeId && e.date <= date)
      .sort((a, b) => (a.date === b.date ? (a.created || 0) - (b.created || 0) : a.date < b.date ? -1 : 1));
    return list.length ? list[list.length - 1] : null;
  }
  function latestOdo(vid) {
    const list = state.entries.filter(e => e.vehicleId === vid && e.odo > 0);
    return list.length ? Math.max(...list.map(e => e.odo)) : NaN;
  }

  // `fromOdo` = the user just changed the odometer (or units/date), so recompute distance
  function updateOdo(form, fromOdo) {
    if (!form || !form.odo) return;
    const d = DIST[state.prefs.dist];
    form.querySelector('.odo-unit').textContent = d.short;
    const hint = form.querySelector('.odo-hint');
    const prev = prevOdo(form.dataset.vid, (form.date && form.date.value) || today(), form.dataset.id);
    const odo = num(form.odo.value);
    const distWrap = form.distance.closest('.field');
    if (!prev) {
      hint.textContent = odo > 0 ? 'First reading for this vehicle — enter the distance this time; next time it’s worked out for you.' : '';
      hint.classList.remove('warn');
      if (fromOdo && distWrap.classList.contains('is-auto')) { distWrap.classList.remove('is-auto'); form.distance.value = ''; }
      return;
    }
    const prevVal = d.fromKm(prev.odo);
    const last = `Last reading ${fmt(prevVal, 0)} ${d.short} on ${shortDate(prev.date)}`;
    if (!(odo > 0)) {
      hint.textContent = last; hint.classList.remove('warn');
      if (fromOdo && distWrap.classList.contains('is-auto')) { distWrap.classList.remove('is-auto'); form.distance.value = ''; }
      return;
    }
    if (odo <= prevVal) {
      hint.textContent = `${last} — this reading is lower, so check it`; hint.classList.add('warn');
      return;
    }
    hint.textContent = `${last} → ${fmt(odo - prevVal, 1)} ${d.short} driven`; hint.classList.remove('warn');
    if (fromOdo) {
      form.distance.value = String(+(odo - prevVal).toFixed(1));
      distWrap.classList.add('is-auto');
    }
  }

  function renderVehicle(id) {
    const v = vById(id);
    if (!v) { view = 'garage'; return renderGarage(); }
    const s = stats(id);
    const odoNow = latestOdo(id);
    const u = effUnit(), d = DIST[u.dist];
    const bestIdx = s.effs.indexOf(s.best);
    const cur = state.prefs.currency;

    return `
      <section class="hero">
        <div class="stage ${v.photo ? 'has-photo' : ''}">
          ${v.reg ? `<span class="plate">${esc(v.reg.toUpperCase())}</span>` : ''}
          ${vehicleVisual(v)}
        </div>
        <div class="hero-info">
          <div><h1>${esc(vName(v))}</h1><div class="sub">${esc(v.fuel || '')}${s.count ? ` · ${s.count} fill-up${s.count === 1 ? '' : 's'}` : ''}${isFinite(odoNow) ? ` · ${fmt(DIST[u.dist].fromKm(odoNow), 0)} ${DIST[u.dist].short} on the clock` : ''}</div></div>
          ${gaugeSVG(s.km, s.l)}
          <div class="hero-actions">
            <button class="btn primary" data-action="focus-log">⛽ Log fill-up</button>
            <button class="btn" data-action="edit-vehicle" data-id="${v.id}">Edit vehicle</button>
          </div>
        </div>
      </section>

      <div class="tiles">
        <div class="tile"><div class="k">${ICON.avg} Average</div><div class="v">${fmt(s.avg)}<span class="u">${esc(u.unit)}</span></div></div>
        <div class="tile"><div class="k">${ICON.best} Best</div><div class="v">${fmt(s.best)}<span class="u">${esc(u.unit)}</span></div></div>
        <div class="tile"><div class="k">${ICON.clock} Latest</div><div class="v">${fmt(s.latest)}<span class="u">${esc(u.unit)}</span></div></div>
        <div class="tile"><div class="k">${ICON.road} Distance tracked</div><div class="v">${fmt(d.fromKm(s.km), 0)}<span class="u">${d.short}</span></div></div>
        <div class="tile"><div class="k">${ICON.pump} Fuel used</div><div class="v">${fmt(s.l, 1)}<span class="u">L</span></div></div>
        <div class="tile"><div class="k">${ICON.cash} Cost per ${d.short === 'mi' ? 'mile' : 'km'}</div><div class="v">${isFinite(s.costPerDist) ? esc(cur) + fmt(s.costPerDist, 2) : '—'}</div></div>
        <div class="tile"><div class="k">${ICON.pump} Avg fuel price</div><div class="v">${isFinite(s.pricePerUnit) ? esc(cur) + fmt(s.pricePerUnit, 2) + `<span class="u">/ ${FUEL[state.prefs.fuel].short}</span>` : '—'}</div></div>
      </div>

      <div class="two-col">
        <form class="panel fill-form" id="logForm" autocomplete="off" data-vid="${v.id}">
          <h2>Log a fill-up <span class="muted">brim to brim works best</span></h2>
          ${fuelForm({ withDate: true, withCost: true })}
          <div class="field"><label>Note <span style="color:var(--ink-3);font-weight:500">optional</span></label><input class="input" name="note" placeholder="Motorway run, roof box, winter tyres…"></div>
          <div class="preview-slot">${resultStrip(NaN, NaN)}</div>
          <button class="btn primary" type="submit" style="width:100%;justify-content:center">Save fill-up</button>
        </form>

        <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:20px;min-width:0">
          <div class="panel">
            <h2>Economy over time <span class="muted">${esc(u.label)}${u.higher ? ' · higher is better' : ' · lower is better'}</span></h2>
            ${s.count >= 1 ? `<div class="chart-wrap" id="chart" data-id="${v.id}"></div>` : emptyState('No fill-ups yet', 'Log your first fill-up and your trend line will appear here.', v)}
          </div>
          <div class="panel">
            <h2>History <span class="muted">${s.count} record${s.count === 1 ? '' : 's'}</span></h2>
            ${s.count ? `<div style="overflow-x:auto"><table class="table">
              <thead><tr><th>Date</th><th class="num">Odometer</th><th class="num">Distance</th><th class="num">Fuel</th><th class="num">${esc(u.label)}</th><th class="num">Cost</th><th class="num">Price / ${FUEL[state.prefs.fuel].short}</th><th>Note</th><th></th></tr></thead>
              <tbody>${s.entries.slice().reverse().map(e => {
                const ev = effOf(e.km, e.litres);
                const isBest = s.count > 1 && s.entries.indexOf(e) === bestIdx;
                return `<tr data-entry="${e.id}" title="Double-click to edit">
                  <td>${niceDate(e.date)}</td>
                  <td class="num">${e.odo > 0 ? fmt(d.fromKm(e.odo), 0) : '—'}</td>
                  <td class="num">${fmt(d.fromKm(e.km), 1)} ${d.short}</td>
                  <td class="num">${fmt(e.litres, 2)} L</td>
                  <td class="num"><span class="eff-pill ${isBest ? 'best' : ''}">${isBest ? '★ ' : ''}${fmt(ev)}</span></td>
                  <td class="num">${e.cost > 0 ? esc(cur) + fmt(e.cost, 2) : '—'}${e.costCur && e.costCur !== 'GBP' ? `<div class="orig" title="1 ${esc(e.costCur)} = ${e.fxRate} GBP">${esc(money(e.costOrig, e.costCur))}</div>` : ''}</td>
                  <td class="num">${e.cost > 0 ? esc(cur) + fmt(e.cost / FUEL[state.prefs.fuel].fromL(e.litres), 3) : '—'}${e.costCur && e.costCur !== 'GBP' ? `<div class="orig">${esc((CURRENCIES[e.costCur] ? CURRENCIES[e.costCur].sym : e.costCur + ' ') + fmt(e.costOrig / FUEL[state.prefs.fuel].fromL(e.litres), 3))}</div>` : ''}</td>
                  <td><div class="note" title="${esc(e.note)}">${esc(e.note || '')}</div></td>
                  <td class="num row-actions"><button class="icon-btn" type="button" title="Edit" data-action="edit-entry" data-id="${e.id}">✎</button><button class="icon-btn" type="button" title="Delete" data-action="delete-entry" data-id="${e.id}">✕</button></td>
                </tr>`;
              }).join('')}</tbody></table></div>` : '<div class="empty">Nothing logged yet.</div>'}
          </div>
        </div>
      </div>`;
  }

  function emptyState(title, text, v) {
    return `<div class="empty">${window.carSVG(v ? v.style : 'hatchback', '#3a4452')}<b>${esc(title)}</b>${esc(text)}</div>`;
  }

  /* ================= Chart ================= */
  function drawChart() {
    const host = $('#chart'); if (!host) return;
    const s = stats(host.dataset.id);
    const pts = s.entries.map((e, i) => ({ e, y: s.effs[i] }));
    const W = Math.max(300, host.clientWidth), H = 240;
    const m = { l: 44, r: 16, t: 16, b: 30 };
    const ys = pts.map(p => p.y).concat(isFinite(s.avg) ? [s.avg] : []);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1);
    lo = Math.max(0, lo - span * 0.25); hi = hi + span * 0.25;
    const step = niceStep((hi - lo) / 4);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const X = i => pts.length === 1 ? (m.l + (W - m.l - m.r) / 2) : m.l + (i / (pts.length - 1)) * (W - m.l - m.r);
    const Y = y => m.t + (1 - (y - lo) / (hi - lo)) * (H - m.t - m.b);

    let grid = '';
    for (let y = lo; y <= hi + 1e-9; y += step) {
      grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(y)}" y2="${Y(y)}" stroke="#232a35" stroke-width="1"/>
               <text x="${m.l - 8}" y="${Y(y) + 4}" text-anchor="end" fill="#6f7b8c" font-size="11">${fmt(y, step < 1 ? 1 : 0)}</text>`;
    }
    const every = Math.ceil(pts.length / Math.max(1, Math.floor((W - m.l - m.r) / 80)));
    const xl = pts.map((p, i) => (i % every === 0 || i === pts.length - 1) ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" fill="#6f7b8c" font-size="11">${shortDate(p.e.date)}</text>` : '').join('');
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
    const area = pts.length > 1 ? `${line} L${X(pts.length - 1)} ${Y(lo)} L${X(0)} ${Y(lo)} Z` : '';
    const avgY = Y(s.avg);

    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">
      <defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".28"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></linearGradient></defs>
      ${grid}${xl}
      ${area ? `<path d="${area}" fill="url(#areaG)"/>` : ''}
      <line x1="${m.l}" x2="${W - m.r}" y1="${avgY}" y2="${avgY}" stroke="#aab4c3" stroke-width="1" stroke-dasharray="4 4" opacity=".7"/>
      <text x="${W - m.r}" y="${avgY - 6}" text-anchor="end" fill="#aab4c3" font-size="11" font-weight="600">avg ${fmt(s.avg)}</text>
      ${pts.length > 1 ? `<path d="${line}" fill="none" stroke="#ff8a3d" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
      <line id="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="#6f7b8c" stroke-width="1" opacity="0"/>
      ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="4.5" fill="#ff8a3d" stroke="#171c24" stroke-width="2"/>`).join('')}
      <circle id="hl" r="6.5" fill="#ffb347" stroke="#171c24" stroke-width="2" opacity="0"/>
      <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" id="hit"/>
    </svg><div class="chart-tip" hidden></div>`;

    const hit = $('#hit', host), tip = $('.chart-tip', host), xh = $('#xh', host), hl = $('#hl', host);
    const u = effUnit(), d = DIST[u.dist];
    hit.style.touchAction = 'pan-y';
    const showAt = ev => {
      const r = host.getBoundingClientRect();
      const mx = ev.clientX - r.left;
      let best = 0, bd = Infinity;
      pts.forEach((p, i) => { const dd = Math.abs(X(i) - mx); if (dd < bd) { bd = dd; best = i; } });
      const p = pts[best];
      xh.setAttribute('x1', X(best)); xh.setAttribute('x2', X(best)); xh.setAttribute('opacity', '.6');
      hl.setAttribute('cx', X(best)); hl.setAttribute('cy', Y(p.y)); hl.setAttribute('opacity', '1');
      tip.hidden = false;
      tip.style.left = X(best) + 'px'; tip.style.top = Y(p.y) + 'px';
      tip.innerHTML = `<div class="d">${niceDate(p.e.date)}</div><b>${fmt(p.y)}</b> ${esc(u.unit)}<div class="d">${fmt(d.fromKm(p.e.km), 1)} ${d.short} · ${fmt(p.e.litres, 2)} L</div>`;
    };
    // pointer events cover mouse hover and finger taps/drags on a phone
    hit.addEventListener('pointermove', showAt);
    hit.addEventListener('pointerdown', showAt);
    hit.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') { tip.hidden = true; xh.setAttribute('opacity', '0'); hl.setAttribute('opacity', '0'); } });
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  /* ================= Calculator view ================= */
  function renderCalc() {
    return `
      <div class="page-head"><div><h1>Quick calculator</h1><p>Work out fuel economy from any trip — miles or km, litres or gallons.</p></div></div>
      <div class="calc-hero">
        <form class="panel" id="calcForm" autocomplete="off">
          <h2>Your trip</h2>
          ${fuelForm({})}
          ${state.vehicles.length ? `
          <div class="field"><label>Save it to a vehicle <span style="color:var(--ink-3);font-weight:500">optional</span></label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
              <select class="input" name="vehicle">${state.vehicles.map(v => `<option value="${v.id}">${esc(vName(v))}</option>`).join('')}</select>
              <button class="btn" type="submit">Save as fill-up</button>
            </div>
          </div>` : ''}
        </form>
        <div class="panel big-result" id="calcResult"></div>
      </div>
      <div class="panel" style="margin-top:20px">
        <h2>How it's worked out</h2>
        <div style="color:var(--ink-2);display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
          <div><b>UK mpg</b> — miles ÷ imperial gallons (4.546 L)</div>
          <div><b>US mpg</b> — miles ÷ US gallons (3.785 L)</div>
          <div><b>km/L</b> — kilometres ÷ litres</div>
          <div><b>L/100km</b> — litres ÷ km × 100 (lower is better)</div>
        </div>
      </div>`;
  }

  function updateCalc() {
    const f = $('#calcForm'); if (!f) return;
    const { km, l } = readFuelForm(f);
    const v = effOf(km, l);
    $('#calcResult').innerHTML = `
      ${gaugeSVG(km, l).replace(/<text[\s\S]*<\/text>/, '').replace('viewBox="0 0 260 172"', 'viewBox="0 0 260 132"')}
      <div class="num">${fmt(v)}</div><div class="lbl">${esc(effUnit().label)}</div>
      <div style="width:100%;margin-top:14px">${resultStrip(km, l)}</div>`;
  }

  /* ================= Render ================= */
  function render() {
    renderSidebar();
    const main = $('#main');
    if (view === 'calc') main.innerHTML = renderCalc();
    else if (view === 'settings') main.innerHTML = renderSettings();
    else if (view.startsWith('vehicle:')) { state.prefs.lastVehicle = view.slice(8); main.innerHTML = renderVehicle(view.slice(8)); }
    else main.innerHTML = renderGarage();
    drawChart();
    updateCalc();
    updateFx($('#logForm'));
    updateOdo($('#logForm'));
    // highlight the chosen unit (also on the Settings page, which was just drawn)
    $$('.unit-switch button').forEach(b => b.classList.toggle('active', b.dataset.unit === state.prefs.eff));
  }

  function go(v) { view = v; render(); $('#main').scrollTop = 0; window.scrollTo(0, 0); }

  /* ================= Events ================= */
  document.addEventListener('click', ev => {
    const goEl = ev.target.closest('[data-go]');
    const act = ev.target.closest('[data-action]');
    const seg = ev.target.closest('.seg button');
    if (seg) {
      const which = seg.parentElement.dataset.seg;
      state.prefs[which] = seg.dataset.val; save();
      $$(`.seg[data-seg="${which}"] button`).forEach(b => b.classList.toggle('active', b.dataset.val === seg.dataset.val));
      if (which === 'fuel') $$('.fill-form').forEach(lf => { updatePriceUnit(lf); solveTrio(lf, null); updateFx(lf); });
      if (which === 'dist') $$('.fill-form').forEach(lf => updateOdo(lf, lf.distance.closest('.field').classList.contains('is-auto')));
      livePreview(); return;
    }
    if (act) { handleAction(act.dataset.action, act, ev); return; }
    if (goEl) { go(goEl.dataset.go); return; }
    const nav = ev.target.closest('.nav-item, .tab[data-view]');
    if (nav) { go(nav.dataset.view); return; }
    const unit = ev.target.closest('.unit-switch button[data-unit]');
    if (unit) { state.prefs.eff = unit.dataset.unit; save(); render(); return; }
    if (ev.target.closest('#unitPill')) { // cycle through the four units
      const ks = Object.keys(EFF); state.prefs.eff = ks[(ks.indexOf(state.prefs.eff) + 1) % ks.length];
      save(); render(); toast('Showing ' + effUnit().label);
    }
  });

  document.addEventListener('input', ev => {
    if (!ev.target.closest(".fill-form, #calcForm")) return;
    const f = ev.target.form, n = ev.target.name;
    if (f && f.classList.contains("fill-form") && n === 'odo') { updateOdo(f, true); livePreview(); return; }
    if (f && f.classList.contains("fill-form") && n === 'distance') f.distance.closest('.field').classList.remove('is-auto'); // typed by hand
    if (f && f.classList.contains("fill-form") && n === 'date') updateOdo(f, f.distance.closest('.field').classList.contains('is-auto'));
    if (f && f.classList.contains("fill-form") && TRIO.includes(n)) {
      solveTrio(f, n); updateFx(f); livePreview(); return;
    }
    if (f && f.classList.contains("fill-form") && ['costCur', 'date', 'rate'].includes(n)) {
      if (n === 'rate') f.dataset.rateEdited = f.costCur.value + (f.date.value || today());
      if (n === 'costCur') { state.prefs.costCur = f.costCur.value; save(); updatePriceUnit(f); }
      updateFx(f); return;
    }
    livePreview();
  });
  document.addEventListener('change', ev => {
    if (ev.target.name === 'costCur' && ev.target.form) { state.prefs.costCur = ev.target.value; save(); updatePriceUnit(ev.target.form); updateFx(ev.target.form); }
  });
  document.addEventListener('focusout', ev => { if (ev.target.name === 'rate' && ev.target.form) setTimeout(() => updateFx(ev.target.form)); });

  function livePreview() {
    $$(".fill-form").forEach(f => { const { km, l } = readFuelForm(f); const slot = f.querySelector(".preview-slot"); if (slot) slot.innerHTML = resultStrip(km, l); });
    updateCalc();
  }

  document.addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target;
    const { km, l } = readFuelForm(f);
    if (!(km > 0)) { toast('Enter the distance driven'); return; }
    if (!(l > 0)) { toast(f.price ? 'Enter fuel used — or total cost and price, to work it out' : 'Enter the fuel used'); return; }
    if (f.id === 'logForm') {
      const id = view.slice(8);
      const c = readCost(f);
      if (c.error) { toast(c.error); return; }
      const odo = num(f.odo.value);
      state.entries.push(Object.assign({ id: uid(), vehicleId: id, date: f.date.value || today(), km, litres: l, note: f.note.value.trim(), created: Date.now() },
        odo > 0 ? { odo: DIST[state.prefs.dist].toKm(odo) } : {}, c));
      save(); render(); toast(`Saved — ${fmt(effOf(km, l))} ${effUnit().unit}`);
    } else if (f.id === 'editForm') {
      const e = state.entries.find(x => x.id === f.dataset.id);
      if (!e) { closeModal(); return; }
      const c = readCost(f);
      if (c.error) { toast(c.error); return; }
      // Untouched distance/fuel keep their exact stored values (no rounding drift)
      const keepKm = f.distance.value + '|' + state.prefs.dist === f.dataset.origDist;
      const keepL = f.fuel.value + '|' + state.prefs.fuel === f.dataset.origFuel;
      const odoIn = num(f.odo.value);
      const keepOdo = f.odo.value + '|' + state.prefs.dist === f.dataset.origOdo;
      delete e.costOrig; delete e.costCur; delete e.fxRate;
      if (!keepOdo) { if (odoIn > 0) e.odo = DIST[state.prefs.dist].toKm(odoIn); else delete e.odo; }
      Object.assign(e, { date: f.date.value || e.date, km: keepKm ? e.km : km, litres: keepL ? e.litres : l, note: f.note.value.trim() }, c);
      save(); closeModal(); render(); toast(`Fill-up updated — ${fmt(effOf(e.km, e.litres))} ${effUnit().unit}`);
    } else if (f.id === 'calcForm') {
      const vid = f.vehicle.value;
      state.entries.push({ id: uid(), vehicleId: vid, date: today(), km, litres: l, cost: 0, note: '', created: Date.now() });
      save(); toast(`Saved to ${vName(vById(vid))}`); go('vehicle:' + vid);
    }
  });

  document.addEventListener('dblclick', ev => { const tr = ev.target.closest('tr[data-entry]'); if (tr && !ev.target.closest('button')) openEntryModal(tr.dataset.entry); });
  window.addEventListener('resize', () => { clearTimeout(drawChart._t); drawChart._t = setTimeout(drawChart, 120); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });

  function handleAction(a, el) {
    if (a === 'add-vehicle') openVehicleModal(null);
    else if (a === 'edit-vehicle') openVehicleModal(el.dataset.id);
    else if (a === 'focus-log') { const i = $('#logForm [name=distance]'); i.scrollIntoView({ behavior: 'smooth', block: 'center' }); i.focus(); }
    else if (a === 'edit-entry') openEntryModal(el.dataset.id);
    else if (a === 'export') exportData();
    else if (a === 'import') importData();
    else if (a === 'install' && deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; render(); }); }
    else if (a === 'quick-log') {
      // jump to the current (or last-viewed) vehicle's fill-up form
      const id = view.startsWith('vehicle:') ? view.slice(8) : (vById(state.prefs.lastVehicle) ? state.prefs.lastVehicle : (state.vehicles[0] || {}).id);
      if (!id) { openVehicleModal(null); return; }
      if (view !== 'vehicle:' + id) go('vehicle:' + id);
      const i = $('#logForm [name=distance]'); i.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => i.focus(), 350);
    }
    else if (a === 'delete-entry') confirmModal('Delete this fill-up?', 'This record will be removed from the history.', 'Delete', () => {
      state.entries = state.entries.filter(e => e.id !== el.dataset.id); save(); render(); toast('Fill-up deleted');
    });
  }

  /* ================= Modals ================= */
  function openModal(title, html) {
    $('#modalTitle').textContent = title;
    // fresh body element so listeners from a previous dialog don't linger
    const old = $('#modalBody'), body = old.cloneNode(false);
    old.replaceWith(body);
    body.innerHTML = html;
    $('#modal').hidden = false;
  }

  function openEntryModal(id) {
    const e = state.entries.find(x => x.id === id); if (!e) return;
    const p = state.prefs;
    openModal('Edit fill-up', `
      <form class="fill-form" id="editForm" autocomplete="off" data-id="${esc(e.id)}" data-vid="${esc(e.vehicleId)}">
        ${fuelForm({ withDate: true, withCost: true })}
        <div class="field"><label>Note <span style="color:var(--ink-3);font-weight:500">optional</span></label><input class="input" name="note" value="${esc(e.note || '')}"></div>
        <div class="preview-slot"></div>
        <div class="modal-actions">
          <button type="button" class="btn danger" data-action="delete-entry" data-id="${esc(e.id)}">Delete</button>
          <div class="right"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Save changes</button></div>
        </div>
      </form>`);
    const f = $('#editForm');
    const tidy = (v, dp) => String(+v.toFixed(dp));
    f.date.value = e.date;
    f.distance.value = tidy(DIST[p.dist].fromKm(e.km), 2);
    f.fuel.value = tidy(FUEL[p.fuel].fromL(e.litres), 2);
    f.dataset.origDist = f.distance.value + '|' + p.dist;
    f.odo.value = e.odo > 0 ? tidy(DIST[p.dist].fromKm(e.odo), 1) : '';
    f.dataset.origOdo = f.odo.value + '|' + p.dist;
    updateOdo(f, false);
    f.dataset.origFuel = f.fuel.value + '|' + p.fuel;
    if (e.cost > 0) {
      const cur = e.costCur || 'GBP';
      f.costCur.value = cur;
      f.cost.value = (e.costCur ? e.costOrig : e.cost).toFixed(2);
      if (cur !== 'GBP' && e.fxRate > 0) { f.dataset.rateEdited = cur + e.date; f.dataset.presetRate = e.fxRate; }
      f.dataset.order = JSON.stringify(['fuel', 'cost']);
    } else {
      f.dataset.order = JSON.stringify(['fuel']);
    }
    updatePriceUnit(f); solveTrio(f, null); updateFx(f); livePreview();
  }
  function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
  $('#modal').addEventListener('click', ev => { if (ev.target.id === 'modal' || ev.target.closest('[data-close]')) closeModal(); });

  function confirmModal(title, text, okLabel, onOk) {
    openModal(title, `<p style="color:var(--ink-2);margin:0 0 18px">${esc(text)}</p>
      <div class="modal-actions"><div class="right"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="okBtn">${esc(okLabel)}</button></div></div>`);
    $('#okBtn').onclick = () => { closeModal(); onOk(); };
  }

  let draft = null;
  function openVehicleModal(id) {
    const v = id ? vById(id) : null;
    draft = v ? Object.assign({}, v) : { id: null, make: '', model: '', year: '', reg: '', fuel: 'Petrol', style: 'hatchback', color: COLOURS[4], photo: null, roofBars: false };
    openModal(v ? 'Edit vehicle' : 'Add vehicle', `
      <div class="stage preview-stage" id="vPreview"></div>
      <div class="row">
        <div class="field"><label>Make</label><input class="input" name="make" value="${esc(draft.make)}" placeholder="e.g. Toyota"></div>
        <div class="field"><label>Model</label><input class="input" name="model" value="${esc(draft.model)}" placeholder="e.g. Prius"></div>
      </div>
      <div class="row">
        <div class="field"><label>Year</label><input class="input" name="year" inputmode="numeric" value="${esc(draft.year)}" placeholder="e.g. 2007"></div>
        <div class="field"><label>Registration <span style="color:var(--ink-3);font-weight:500">optional</span></label><input class="input" name="reg" value="${esc(draft.reg)}" placeholder="e.g. AB07 CDE"></div>
      </div>
      <div class="field"><label>Fuel</label><select class="input" name="fuel">${FUEL_TYPES.map(f => `<option ${f === draft.fuel ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
      <label class="toggle"><input type="checkbox" id="roofBarsToggle" ${draft.roofBars ? 'checked' : ''}><span class="track"></span> Roof bars</label>
      <div class="field"><label>Body style</label><div class="style-pick" id="stylePick"></div></div>
      <div class="field"><label>Colour</label><div class="swatches" id="swatches"></div></div>
      <div class="field"><label>Photo <span style="color:var(--ink-3);font-weight:500">optional — replaces the illustration</span></label>
        <div style="display:flex;gap:8px"><button class="btn small" type="button" id="pickPhoto">Choose photo…</button><button class="btn small ghost" type="button" id="clearPhoto">Use illustration</button></div>
        <input type="file" accept="image/*" id="photoInput" hidden>
      </div>
      <div class="modal-actions">
        ${v ? '<button class="btn danger" id="delVehicle">Delete vehicle</button>' : ''}
        <div class="right"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="saveVehicle">${v ? 'Save changes' : 'Add to garage'}</button></div>
      </div>`);
    refreshVehicleModal();

    const body = $('#modalBody');
    body.addEventListener('input', e => { if (e.target.name) { draft[e.target.name] = e.target.value; } });
    body.addEventListener('change', e => { if (e.target.name) { draft[e.target.name] = e.target.value; } });
    $('#pickPhoto').onclick = () => {
      if (isNative) window.webkit.messageHandlers.bridge.postMessage(JSON.stringify({ type: 'pickPhoto' }));
      else $('#photoInput').click();
    };
    $('#photoInput').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader(); r.onload = () => window.__photoPicked(r.result); r.readAsDataURL(file);
    };
    $('#clearPhoto').onclick = () => { draft.photo = null; refreshVehicleModal(); };
    $('#roofBarsToggle').onchange = e => { draft.roofBars = e.target.checked; refreshVehicleModal(); };
    $('#saveVehicle').onclick = () => {
      if (!draft.make.trim() && !draft.model.trim()) { toast('Give the vehicle a make or model'); return; }
      if (draft.id) { Object.assign(vById(draft.id), draft); }
      else { draft.id = uid(); state.vehicles.push(draft); }
      save(); const nid = draft.id; closeModal(); go('vehicle:' + nid); toast('Garage updated');
    };
    const del = $('#delVehicle');
    if (del) del.onclick = () => {
      const name = vName(v);
      confirmModal(`Delete ${name}?`, 'The vehicle and all of its fill-up history will be removed. This cannot be undone.', 'Delete vehicle', () => {
        state.vehicles = state.vehicles.filter(x => x.id !== v.id);
        state.entries = state.entries.filter(e => e.vehicleId !== v.id);
        save(); go('garage'); toast(`${name} removed`);
      });
    };
  }

  function refreshVehicleModal() {
    if (!draft) return;
    const pv = $('#vPreview'); if (!pv) return;
    pv.classList.toggle('has-photo', !!draft.photo);
    pv.innerHTML = vehicleVisual(draft);
    $('#stylePick').innerHTML = Object.keys(window.CAR_STYLES).map(k =>
      `<button type="button" data-style="${k}" class="${k === draft.style ? 'active' : ''}">${window.carSVG(k, draft.color, { roofBars: draft.roofBars })}${esc(window.CAR_STYLES[k].label)}</button>`).join('');
    $('#swatches').innerHTML = COLOURS.map(c => `<button type="button" class="swatch ${c === draft.color ? 'active' : ''}" style="background:${c}" data-color="${c}" aria-label="${c}"></button>`).join('')
      + `<label class="swatch" style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);cursor:pointer;position:relative" title="Custom colour"><input type="color" value="${draft.color}" id="customColour" style="opacity:0;position:absolute;inset:0;width:100%;height:100%;cursor:pointer"></label>`;
    $$('#stylePick button').forEach(b => b.onclick = () => { draft.style = b.dataset.style; refreshVehicleModal(); });
    $$('#swatches [data-color]').forEach(b => b.onclick = () => { draft.color = b.dataset.color; refreshVehicleModal(); });
    $('#customColour').oninput = e => { draft.color = e.target.value; pv.innerHTML = vehicleVisual(draft); };
    $('#customColour').onchange = () => refreshVehicleModal();
  }

  // Called by the file input, or by the native shell after its open panel.
  window.__photoPicked = function (dataUrl) {
    if (!draft || !dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const max = 1100, sc = Math.min(1, max / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      draft.photo = c.toDataURL('image/jpeg', 0.85);
      refreshVehicleModal();
    };
    img.onerror = () => toast("Couldn't read that image");
    img.src = dataUrl;
  };

  render();
})();
