// GrayNinja の画面。計算は js/gray-core.js、文言は js/messages.js（js/i18n.js 経由）から取る
(() => {
  'use strict';

  const G = globalThis.GrayCore;
  const I = globalThis.GrayI18n;
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => I.t(key, vars);

  // 添字の数字を下付き文字に（計算過程の b₃ など）
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).replace(/\d/g, (d) => SUB[d]);

  // ── タブ（WAI-ARIA の tabs パターン。矢印・Home・End で移動）──
  const TABS = ['basics', 'how', 'disc', 'convert', 'security', 'learn'];
  let activeTab = 'basics';
  let booted = false;

  function selectTab(name, focus) {
    if (!TABS.includes(name)) return;
    activeTab = name;
    for (const id of TABS) {
      const tab = $(`tab-${id}`);
      const on = id === name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      $(`panel-${id}`).hidden = !on;
    }
    if (focus) $(`tab-${name}`).focus();
    if (name !== 'basics') stopAuto();
    if (name === 'disc') {
      resizeDiscs();
      resizeChart();
    } else {
      stopSpin();
    }
    if (name === 'security') resizeLeakChart();
    if (name === 'convert' && convDirty) renderConvertTexts();
    try {
      history.replaceState(null, '', `#${name}`);
    } catch {
      // file:// などで書き換えられなくても、表示は切り替わる
    }
  }

  function initTabs() {
    for (const id of TABS) $(`tab-${id}`).addEventListener('click', () => selectTab(id, false));
    document.querySelector('.tabs').addEventListener('keydown', (e) => {
      const i = TABS.indexOf(activeTab);
      let next = null;
      if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
      else if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
      else if (e.key === 'Home') next = TABS[0];
      else if (e.key === 'End') next = TABS[TABS.length - 1];
      if (next) {
        e.preventDefault();
        selectTab(next, true);
      }
    });
  }

  // 「?」ボタンで説明を開閉する（hover だけに頼らない）
  function initInfoButtons() {
    for (const btn of document.querySelectorAll('button.info')) {
      btn.addEventListener('click', () => {
        const tip = $(btn.getAttribute('aria-controls'));
        const open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        tip.hidden = !open;
      });
    }
  }

  // ── 基本タブ ──
  const basics = { n: 4, val: 0, rows: [], timer: null };
  const maxVal = () => (1 << basics.n) - 1;

  // ビット列のうち、反転した位置（最下位が0）を mark で囲んで描く
  function bitsCell(bits, flips) {
    const td = document.createElement('td');
    const n = bits.length;
    const set = new Set(flips.map((p) => n - 1 - p));
    let plain = '';
    const flush = () => {
      if (plain) td.append(document.createTextNode(plain));
      plain = '';
    };
    for (let i = 0; i < n; i++) {
      if (set.has(i)) {
        flush();
        const m = document.createElement('mark');
        m.className = 'flip';
        m.textContent = bits[i];
        td.append(m);
      } else {
        plain += bits[i];
      }
    }
    flush();
    return td;
  }

  // 表はビット数が変わったときだけ作り直す（値が変わったときは行のクラスを付け替えるだけ）
  function buildTable() {
    const tbody = $('seqTbl').querySelector('tbody');
    const frag = document.createDocumentFragment();
    basics.rows = [];
    for (const r of G.sequence(basics.n)) {
      const tr = document.createElement('tr');
      tr.dataset.index = String(r.i);
      const dec = document.createElement('td');
      dec.textContent = String(r.i);
      tr.append(dec, bitsCell(r.bin, r.flipBin), bitsCell(r.gray, r.flipGray));
      for (const d of [r.dBin, r.dGray]) {
        const td = document.createElement('td');
        td.textContent = String(d);
        tr.append(td);
      }
      frag.append(tr);
      basics.rows.push(tr);
    }
    tbody.replaceChildren(frag);
  }

  // 表の中だけをスクロールして、選んだ行を見える位置に置く（ページ全体は動かさない）
  // 位置を読むとレイアウトが強制されるので、初期化中（値は0で先頭の行）と基本のタブが隠れているときは読まない
  function revealRow(tr) {
    if (!booted || activeTab !== 'basics') return;
    const wrap = $('tableWrap');
    const head = wrap.querySelector('thead').offsetHeight;
    const top = tr.offsetTop;
    const bottom = top + tr.offsetHeight;
    if (top < wrap.scrollTop + head) wrap.scrollTop = top - head;
    else if (bottom > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = bottom - wrap.clientHeight;
  }

  function renderValue() {
    const { n, val } = basics;
    $('decOut').textContent = String(val);
    $('binOut').textContent = G.pad(val, n);
    $('grayOut').textContent = G.pad(G.toGray(val), n);
    const next = (val + 1) & maxVal();
    $('hdOut').textContent = t('card.nextValue', { g: G.hamming(G.toGray(val), G.toGray(next)), b: G.hamming(val, next) });
    $('val').value = String(val);
    if (document.activeElement !== $('valNum')) $('valNum').value = String(val);
    const prev = $('seqTbl').querySelector('tr.active');
    if (prev) {
      prev.classList.remove('active');
      prev.removeAttribute('aria-current');
    }
    const tr = basics.rows[val];
    if (tr) {
      tr.classList.add('active');
      tr.setAttribute('aria-current', 'true');
      revealRow(tr);
    }
  }

  // 値を設定する。循環なら範囲の外は巻き戻し、そうでなければ端で止める
  function setVal(v) {
    const max = maxVal();
    const x = Math.trunc(Number(v));
    if (!Number.isFinite(x)) return;
    basics.val = $('wrap').checked ? ((x % (max + 1)) + (max + 1)) % (max + 1) : Math.max(0, Math.min(max, x));
    renderValue();
  }

  function setBits(raw) {
    const x = Math.trunc(Number(raw));
    if (!Number.isFinite(x) || String(raw).trim() === '') {
      $('bits').value = String(basics.n);
      return;
    }
    basics.n = G.clampN(x);
    $('bits').value = String(basics.n);
    $('val').max = String(maxVal());
    $('valNum').max = String(maxVal());
    buildTable();
    setVal(Math.min(basics.val, maxVal()));
  }

  function step(delta) {
    const max = maxVal();
    if (!$('wrap').checked && ((delta > 0 && basics.val >= max) || (delta < 0 && basics.val <= 0))) return false;
    setVal(basics.val + delta);
    return true;
  }

  function startAuto() {
    stopAuto();
    $('auto').checked = true;
    basics.timer = setInterval(() => {
      if (!step(1)) stopAuto(); // 循環しないとき、最後の値に着いたら止める
    }, Number($('speed').value));
  }

  function stopAuto() {
    if (basics.timer) clearInterval(basics.timer);
    basics.timer = null;
    $('auto').checked = false;
  }

  function renderSpeed() {
    $('speedValue').textContent = t('ctl.speedValue', { ms: $('speed').value });
  }

  // ショートカットは基本タブを表示しているときだけ。ボタン・入力欄・タブなどにフォーカスがあるときは奪わない
  function isInteractive(el) {
    return !!(el && el.closest && el.closest('button, input, select, textarea, a, summary, [role="tab"], [tabindex]'));
  }

  function initBasics() {
    $('bits').addEventListener('change', (e) => setBits(e.target.value));
    $('val').addEventListener('input', (e) => setVal(e.target.value));
    // 数値欄: 打っている間は、有効な値のときだけ反映（欄を書き換えない）。確定（change・blur）で範囲に収めて書き戻す
    $('valNum').addEventListener('input', (e) => {
      const raw = e.target.value;
      if (/^\d+$/.test(raw) && Number(raw) <= maxVal()) setVal(raw);
    });
    $('valNum').addEventListener('change', (e) => {
      const raw = e.target.value;
      if (raw.trim() === '' || !Number.isFinite(Number(raw))) e.target.value = String(basics.val);
      else setVal(raw);
      e.target.value = String(basics.val);
    });
    $('prev').addEventListener('click', () => step(-1));
    $('next').addEventListener('click', () => step(1));
    $('auto').addEventListener('change', (e) => (e.target.checked ? startAuto() : stopAuto()));
    $('speed').addEventListener('input', () => {
      renderSpeed();
      if (basics.timer) startAuto();
    });
    $('seqTbl').querySelector('tbody').addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (tr) setVal(tr.dataset.index);
    });
    document.addEventListener('keydown', (e) => {
      if (activeTab !== 'basics' || e.altKey || e.ctrlKey || e.metaKey || isInteractive(e.target)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (basics.timer) stopAuto();
        else startAuto();
      }
    });
    renderSpeed();
    setBits(4);
  }

  // ── ディスクタブ ──
  // 角度は disc.phi の1つだけ。読み取り線は真上に固定で、ディスクのほうが回る。読み取り値は読み取り線の下のセクター
  const disc = {
    n: 4, phi: G.sectorCenter(0, 4), spinning: false, last: 0, raf: 0, cache: {}, size: 0, lastSector: -1,
    // センサーのずれ（誤読シミュレーター）。amount はセクター幅に対する割合
    offsetOn: false, pattern: 'alternate', amount: 0.1, seed: 1, sweep: null, chart: null
  };

  // センサーのずれ（度、外側のリングから）。オフなら null（ずれなし）
  const offsets = () => (disc.offsetOn ? G.sensorOffsets(disc.n, disc.pattern, disc.amount, disc.seed) : null);
  const CANVAS = { gray: 'discCanvasGray', binary: 'discCanvasBinary' };

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ディスクの絵（回す前）を、同じビットが続く区間ごとに1つの弧として描いてキャッシュする
  function renderStatic(kind, px) {
    const off = document.createElement('canvas');
    off.width = px;
    off.height = px;
    const ctx = off.getContext('2d');
    const n = disc.n;
    const size = 1 << n;
    const c = px / 2;
    const rOuter = c - px * 0.04;
    const rInner = px * 0.07;
    const gap = Math.min(px * 0.008, ((rOuter - rInner) / n) * 0.15);
    const ring = (rOuter - rInner - gap * (n - 1)) / n;
    const color0 = cssVar('--disc-0');
    const color1 = cssVar('--disc-1');
    const line = cssVar('--disc-line');
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;
    const w = 360 / size;
    for (let k = 0; k < n; k++) {
      const r1 = rOuter - k * (ring + gap);
      const r0 = r1 - ring;
      for (const [a, b, bit] of G.ringRuns(n, k, kind)) {
        ctx.beginPath();
        ctx.arc(c, c, r1, rad(a * w), rad(b * w));
        ctx.arc(c, c, r0, rad(b * w), rad(a * w), true);
        ctx.closePath();
        ctx.fillStyle = bit ? color1 : color0;
        ctx.fill();
      }
      ctx.lineWidth = Math.max(1, px / 400);
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.arc(c, c, r1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c, r0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // セクターの境目（細かすぎるときは描かない）
    const arcOuter = (2 * Math.PI * rOuter) / size;
    if (arcOuter >= 6) {
      ctx.strokeStyle = line;
      ctx.lineWidth = Math.max(0.5, px / 800);
      ctx.beginPath();
      for (let s = 0; s < size; s++) {
        const a = rad(s * w);
        ctx.moveTo(c + rInner * Math.cos(a), c + rInner * Math.sin(a));
        ctx.lineTo(c + rOuter * Math.cos(a), c + rOuter * Math.sin(a));
      }
      ctx.stroke();
    }
    return { canvas: off, rOuter, rInner, ring, gap, color0, color1 };
  }

  // リングに0/1を書く（文字が入る大きさのときだけ）。ディスクと一緒に回すと逆さまになるので、毎回正立で描く
  function drawNumbers(ctx, kind, geo, px) {
    const n = disc.n;
    const size = 1 << n;
    const c = px / 2;
    const w = 360 / size;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < n; k++) {
      const mid = geo.rOuter - k * (geo.ring + geo.gap) - geo.ring / 2;
      const arc = (2 * Math.PI * mid) / size;
      const fs = Math.min(geo.ring * 0.6, arc * 0.6, px * 0.04);
      if (fs < px * 0.018) continue;
      ctx.font = `${fs}px ui-monospace, Consolas, monospace`;
      for (let s = 0; s < size; s++) {
        const bit = (G.codeOf(s, kind) >>> (n - 1 - k)) & 1;
        const a = (((s + 0.5) * w - disc.phi - 90) * Math.PI) / 180;
        ctx.fillStyle = bit ? geo.color0 : geo.color1;
        ctx.fillText(String(bit), c + mid * Math.cos(a), c + mid * Math.sin(a));
      }
    }
  }

  function resizeDiscs() {
    const el = $(CANVAS.gray);
    const css = Math.round(el.getBoundingClientRect().width);
    if (!css) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(css * dpr);
    if (px === disc.size) {
      drawDiscs();
      return;
    }
    disc.size = px;
    for (const id of Object.values(CANVAS)) {
      $(id).width = px;
      $(id).height = px;
    }
    disc.cache = {};
    drawDiscs();
  }

  function drawOne(kind) {
    const cv = $(CANVAS[kind]);
    const px = cv.width;
    if (!px) return;
    if (!disc.cache[kind]) disc.cache[kind] = renderStatic(kind, px);
    const geo = disc.cache[kind];
    const { canvas: img, rOuter, rInner } = geo;
    const ctx = cv.getContext('2d');
    const c = px / 2;
    ctx.clearRect(0, 0, px, px);
    // ディスク上の角度 phi が真上に来るように、ディスクを −phi 回す
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((-disc.phi * Math.PI) / 180);
    ctx.drawImage(img, -c, -c);
    ctx.restore();
    if ($('showNumbers').checked) drawNumbers(ctx, kind, geo, px);
    const w = G.sectorWidth(disc.n);
    const s = G.sectorAt(disc.phi, disc.n);
    // 読み取ったセクターを囲む（画面上の角度 = ディスク上の角度 − phi）
    if ($('highlightSector').checked) {
      const a0 = ((s * w - disc.phi - 90) * Math.PI) / 180;
      const a1 = (((s + 1) * w - disc.phi - 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(c, c, rOuter + px * 0.012, a0, a1);
      ctx.arc(c, c, rInner - px * 0.006, a1, a0, true);
      ctx.closePath();
      ctx.lineWidth = Math.max(2, px / 160);
      ctx.strokeStyle = cssVar('--disc-highlight');
      ctx.stroke();
    }
    // 読み取り線（真上、固定）
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c, c - rOuter - px * 0.03);
    ctx.lineWidth = Math.max(2, px / 200);
    ctx.strokeStyle = cssVar('--disc-read');
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, Math.max(3, px / 100), 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--disc-read');
    ctx.fill();
    // ずらしたセンサーの位置（画面上の角度 = ずれ。各リングの中央に点を打つ）
    const off = offsets();
    if (off) {
      for (let k = 0; k < disc.n; k++) {
        const mid = rOuter - k * (geo.ring + geo.gap) - geo.ring / 2;
        const a = ((off[k] - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.arc(c + mid * Math.cos(a), c + mid * Math.sin(a), Math.max(3, Math.min(geo.ring * 0.22, px / 60)), 0, Math.PI * 2);
        ctx.fillStyle = cssVar('--disc-read');
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, px / 300);
        ctx.strokeStyle = cssVar('--disc-0');
        ctx.stroke();
      }
    }
  }

  // 読み取りの状態（正しい値／隣の値／誤読）。ずれがオフのときは出さない
  function renderStatus(id, r, n) {
    const el = $(id);
    if (!disc.offsetOn) {
      el.textContent = '';
      el.className = 'status';
      return;
    }
    const d = G.ringDistance(r.value, r.sector, n);
    el.textContent = d === 0 ? t('mis.statusExact') : d === 1 ? t('mis.statusAdjacent') : t('mis.statusFar', { d });
    el.className = `status ${d === 0 ? 'ok' : d === 1 ? 'adj' : 'far'}`;
  }

  function renderReading() {
    const n = disc.n;
    const s = G.sectorAt(disc.phi, n);
    const off = offsets();
    const g = G.readAt(disc.phi, n, 'gray', off);
    const b = G.readAt(disc.phi, n, 'binary', off);
    $('sectorOut').textContent = t('disc.sectorValue', { s, total: 1 << n });
    $('discGray').textContent = t('disc.readValue', { code: G.pad(g.code, n), v: g.value });
    $('discBinary').textContent = t('disc.readValue', { code: G.pad(b.code, n), v: b.value });
    renderStatus('discGrayStatus', g, n);
    renderStatus('discBinaryStatus', b, n);
    $('angle').value = String(Math.round(disc.phi * 10) / 10);
    $('angleValue').textContent = t('disc.angleValue', { a: (Math.round(disc.phi * 10) / 10).toFixed(1) });
    if (s !== disc.lastSector) {
      disc.lastSector = s;
      $(CANVAS.gray).setAttribute('aria-label', t('disc.grayAlt', { n, s, code: G.pad(g.code, n) }));
      $(CANVAS.binary).setAttribute('aria-label', t('disc.binAlt', { n, s, code: G.pad(b.code, n) }));
    }
  }

  function drawDiscs() {
    drawOne('gray');
    drawOne('binary');
    renderReading();
    if (disc.sweep) drawChart();
  }

  // ── 一周の集計とグラフ（ずれがオンのとき）──
  const pct = (x, total) => ((Math.round((10000 * x) / total)) / 100).toFixed(2);

  function computeSweep() {
    $('sweepBox').hidden = !disc.offsetOn;
    disc.chart = null;
    if (!disc.offsetOn) {
      disc.sweep = null;
      return;
    }
    const off = offsets();
    disc.sweep = { gray: G.sweep(disc.n, 'gray', off), binary: G.sweep(disc.n, 'binary', off), off };
    renderSweepTexts();
    resizeChart();
  }

  function renderSweepTexts() {
    if (!disc.sweep) return;
    const { gray, binary, off } = disc.sweep;
    $('sweepLead').textContent = t('sw.lead', { samples: gray.total.toLocaleString('en-US') });
    const frag = document.createDocumentFragment();
    for (const [kind, r] of [['sw.kindGray', gray], ['sw.kindBin', binary]]) {
      const tr = document.createElement('tr');
      const cells = [
        t(kind),
        t('sw.pct', { p: pct(r.exact, r.total) }),
        t('sw.pct', { p: pct(r.adjacent, r.total) }),
        t('sw.pct', { p: pct(r.far, r.total) }),
        r.far ? t('sw.maxValue', { d: r.maxErr }) : t('sw.none'),
        r.worst.length ? r.worst.slice(0, 3).map((x) => `${x.truth}→${x.read}`).join(', ') : t('sw.none')
      ];
      cells.forEach((v, i) => {
        const cell = document.createElement(i ? 'td' : 'th');
        if (!i) cell.scope = 'row';
        cell.textContent = v;
        tr.append(cell);
      });
      if (r.far) tr.classList.add('has-far');
      frag.append(tr);
    }
    $('sweepTbl').querySelector('tbody').replaceChildren(frag);
    const fmt = (deg) => `${deg >= 0 ? '+' : '−'}${Math.abs(deg).toFixed(1)}°`;
    $('sweepOffsets').textContent = t('sw.offsets', { list: off.map(fmt).join(', ') });
    $('sweepChart').setAttribute('aria-label', t('sw.chartAlt', { g: pct(gray.far, gray.total), b: pct(binary.far, binary.total) }));
  }

  function resizeChart() {
    const cv = $('sweepChart');
    if (!disc.sweep) return;
    const css = Math.round(cv.getBoundingClientRect().width);
    if (!css) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = Math.round(css * dpr);
    const H = Math.round(200 * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
      disc.chart = null;
    }
    drawChart();
  }

  // グラフの絵（いまの位置の線を除く）。横軸はディスクの位置 0〜360°、縦軸は読んだ値 0〜2ⁿ−1
  function renderChartStatic(W, H) {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const ctx = off.getContext('2d');
    const S = 1 << disc.n;
    const pad = Math.round(H * 0.06);
    const x = (phi) => (phi / 360) * W;
    const y = (v) => H - pad - ((v + 0.5) / S) * (H - 2 * pad);
    ctx.strokeStyle = cssVar('--border');
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    const line = (pts, color, width, dash) => {
      ctx.beginPath();
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      pts.forEach(([p, v], i) => (i ? ctx.lineTo(x(p), y(v)) : ctx.moveTo(x(p), y(v))));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const truth = [];
    for (let s = 0; s < S; s++) truth.push([(s * 360) / S, s], [((s + 1) * 360) / S, s]);
    const unit = Math.max(1, H / 200);
    line(truth, cssVar('--chart-truth'), unit, [6 * unit, 4 * unit]);
    line(disc.sweep.binary.points, cssVar('--chart-bin'), 1.5 * unit);
    line(disc.sweep.gray.points, cssVar('--chart-gray'), 1.5 * unit);
    return off;
  }

  function drawChart() {
    const cv = $('sweepChart');
    if (!cv.width || !disc.sweep) return;
    if (!disc.chart) disc.chart = renderChartStatic(cv.width, cv.height);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(disc.chart, 0, 0);
    const xx = (disc.phi / 360) * cv.width;
    ctx.beginPath();
    ctx.moveTo(xx, 0);
    ctx.lineTo(xx, cv.height);
    ctx.strokeStyle = cssVar('--disc-read');
    ctx.lineWidth = Math.max(2, cv.height / 120);
    ctx.stroke();
  }

  function renderOffsetControls() {
    $('offsetPattern').disabled = !disc.offsetOn;
    $('offsetAmount').disabled = !disc.offsetOn;
    $('offsetShuffle').disabled = !disc.offsetOn || disc.pattern !== 'random';
    $('offsetAmountValue').textContent = t('mis.amountValue', { p: Math.round(disc.amount * 100) });
  }

  function updateOffsets() {
    renderOffsetControls();
    computeSweep();
    drawDiscs();
  }

  function setPhi(phi) {
    disc.phi = G.normAngle(phi);
    drawDiscs();
  }

  function renderSpinButton() {
    const btn = $('spin');
    btn.textContent = t(disc.spinning ? 'disc.stop' : 'disc.spin');
    btn.setAttribute('aria-pressed', String(disc.spinning));
  }

  // 回転は時間基準（requestAnimationFrame の経過時間 × 速さ）。描画の重さで速さが変わらない
  function frame(now) {
    if (!disc.spinning) return;
    const dt = disc.last ? (now - disc.last) / 1000 : 0;
    disc.last = now;
    setPhi(disc.phi + Number($('spinSpeed').value) * Math.min(dt, 0.1));
    disc.raf = requestAnimationFrame(frame);
  }

  function startSpin() {
    if (disc.spinning) return;
    disc.spinning = true;
    disc.last = 0;
    renderSpinButton();
    disc.raf = requestAnimationFrame(frame);
  }

  function stopSpin() {
    if (!disc.spinning) return;
    disc.spinning = false;
    cancelAnimationFrame(disc.raf);
    renderSpinButton();
  }

  function setDiscBits(raw) {
    const x = Math.trunc(Number(raw));
    if (!Number.isFinite(x) || String(raw).trim() === '') {
      $('discBits').value = String(disc.n);
      return;
    }
    disc.n = G.clampN(x);
    $('discBits').value = String(disc.n);
    disc.cache = {};
    disc.lastSector = -1;
    computeSweep();
    drawDiscs();
  }

  function renderSpinSpeed() {
    $('spinSpeedValue').textContent = t('disc.speedValue', { v: $('spinSpeed').value });
  }

  function initDisc() {
    $('discBits').addEventListener('change', (e) => setDiscBits(e.target.value));
    $('spin').addEventListener('click', () => (disc.spinning ? stopSpin() : startSpin()));
    $('spinSpeed').addEventListener('input', renderSpinSpeed);
    $('angle').addEventListener('input', (e) => {
      stopSpin();
      setPhi(Number(e.target.value));
    });
    const jump = (d) => {
      stopSpin();
      const size = 1 << disc.n;
      const s = (G.sectorAt(disc.phi, disc.n) + d + size) % size;
      setPhi(G.sectorCenter(s, disc.n));
    };
    $('prevSector').addEventListener('click', () => jump(-1));
    $('nextSector').addEventListener('click', () => jump(1));
    $('offsetOn').addEventListener('change', (e) => {
      disc.offsetOn = e.target.checked;
      updateOffsets();
    });
    $('offsetPattern').addEventListener('change', (e) => {
      disc.pattern = G.OFFSET_PATTERNS.includes(e.target.value) ? e.target.value : 'alternate';
      updateOffsets();
    });
    $('offsetAmount').addEventListener('input', (e) => {
      disc.amount = Number(e.target.value) / 100;
      updateOffsets();
    });
    $('offsetShuffle').addEventListener('click', () => {
      disc.seed = (disc.seed % 999983) + 1;
      updateOffsets();
    });
    for (const id of ['showNumbers', 'highlightSector']) {
      $(id).addEventListener('change', () => {
        disc.cache = {};
        drawDiscs();
      });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopSpin();
    });
    const onResize = () => {
      if (activeTab !== 'disc') return;
      resizeDiscs();
      resizeChart();
    };
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.querySelector('#panel-disc .viz'));
    else window.addEventListener('resize', onResize);
    renderSpinSpeed();
    renderSpinButton();
    renderOffsetControls();
  }

  // ── 変換タブ ──
  function stepTexts(bits, toGray, r) {
    const n = bits.length;
    const src = toGray ? 'b' : 'g';
    const dst = toGray ? 'g' : 'b';
    const list = [{ header: t('step.input', { kind: t(toGray ? 'kind.bin' : 'kind.gray'), bits }), calc: bits.split('').map((c, i) => `${src}${sub(n - 1 - i)}=${c}`).join(', ') }];
    if (n > G.MAX_STEP_BITS) {
      list.push({ header: t('step.omitted', { max: G.MAX_STEP_BITS }), calc: '' });
    } else {
      r.steps.forEach((st, i) => {
        if (st.kind === 'msb') {
          list.push({ header: t('step.msb', { k: i + 1 }), calc: `${dst}${sub(st.j)} = ${src}${sub(st.j)} = ${st.value}` });
        } else {
          list.push({ header: t('step.bit', { k: i + 1, j: st.j }), calc: `${dst}${sub(st.j)} = b${sub(st.j + 1)} ⊕ ${src}${sub(st.j)} = ${st.left} ⊕ ${st.right} = ${st.out}` });
        }
      });
    }
    list.push({ header: t('step.result', { from: bits, to: r.result }), calc: '', final: true });
    return list;
  }

  function renderSteps(container, list) {
    const frag = document.createDocumentFragment();
    for (const s of list) {
      const div = document.createElement('div');
      div.className = s.final ? 'step step-final' : 'step';
      const h = document.createElement('div');
      h.className = 'step-header';
      h.textContent = s.header;
      div.append(h);
      if (s.calc) {
        const c = document.createElement('div');
        c.className = 'step-calc mono';
        c.textContent = s.calc;
        div.append(c);
      }
      frag.append(div);
    }
    container.replaceChildren(frag);
  }

  const CONV = {
    true: { input: 'binIn', out: 'grayOut2', value: 'toGrayValue', steps: 'binaryToGraySteps' },
    false: { input: 'grayIn', out: 'binOut2', value: 'toBinValue', steps: 'grayToBinarySteps' }
  };

  // 変換する。不正な入力はエラーを出し、計算過程と値も消す（前の結果を残さない）
  function runConvert(toGray) {
    const ids = CONV[toGray];
    const norm = G.normalizeBits($(ids.input).value);
    const out = $(ids.out);
    if (!norm.ok) {
      out.textContent = t(`err.${norm.error}`, { max: G.MAX_BITS, len: norm.length, char: norm.char, index: norm.index });
      out.classList.add('error');
      $(ids.input).setAttribute('aria-invalid', 'true');
      $(ids.value).textContent = '';
      $(ids.steps).replaceChildren();
      return;
    }
    const r = G.steps(norm.bits, toGray);
    out.textContent = r.result;
    out.classList.remove('error');
    $(ids.input).removeAttribute('aria-invalid');
    $(ids.value).textContent = t('conv.value', { v: G.bitsToDecimal(toGray ? norm.bits : r.result) });
    renderSteps($(ids.steps), stepTexts(norm.bits, toGray, r));
  }

  function initConvert() {
    $('toGray').addEventListener('click', () => runConvert(true));
    $('toBin').addEventListener('click', () => runConvert(false));
    $('binIn').addEventListener('keydown', (e) => e.key === 'Enter' && !e.isComposing && runConvert(true));
    $('grayIn').addEventListener('keydown', (e) => e.key === 'Enter' && !e.isComposing && runConvert(false));
    renderConvertTexts();
  }

  // 変換のタブの文言と結果は、そのタブを開いているときだけ作る（開いたときに作り直す）
  let convDirty = true;
  function renderConvertTexts() {
    if (activeTab !== 'convert') {
      convDirty = true;
      return;
    }
    convDirty = false;
    for (const id of ['binHint', 'grayHint']) $(id).textContent = t('conv.hint', { max: G.MAX_BITS.toLocaleString('en-US') });
    runConvert(true);
    runConvert(false);
  }

  // ── しくみタブ ──
  // 反射で作る: 段 s は 0〜2(n−1)。0＝1ビットの列、奇数＝k ビットの列を鏡に映す、偶数＝先頭に0と1を付けて k+1 ビットに
  const refl = { n: 3, s: 0 };
  const hanoi = { n: 3, k: 0, moves: G.hanoiMoves(3) };

  function codeRow(code, markFirst, index) {
    const row = document.createElement('div');
    row.className = 'ref-row';
    if (index !== null) {
      const i = document.createElement('span');
      i.className = 'ref-index';
      i.textContent = String(index);
      row.append(i);
    }
    const c = document.createElement('span');
    c.className = 'ref-code';
    if (markFirst) {
      const m = document.createElement('mark');
      m.className = 'flip';
      m.textContent = code[0];
      c.append(m, document.createTextNode(code.slice(1)));
    } else {
      c.textContent = code;
    }
    row.append(c);
    return row;
  }

  function renderRefl() {
    const stages = G.reflectStages(refl.n);
    const last = 2 * (refl.n - 1);
    const frag = document.createDocumentFragment();
    let status;
    let list = null;
    if (refl.s === 0) {
      list = stages[0];
      list.forEach((c, i) => frag.append(codeRow(c, false, i)));
      status = t('ref.start');
    } else if (refl.s % 2 === 1) {
      const k = (refl.s + 1) / 2;
      const cur = stages[k - 1];
      cur.forEach((c, i) => frag.append(codeRow(c, false, i)));
      const line = document.createElement('div');
      line.className = 'ref-mirror';
      line.textContent = t('ref.mirrorLine');
      frag.append(line);
      [...cur].reverse().forEach((c) => {
        const row = codeRow(c, false, null);
        row.classList.add('ref-dim');
        frag.append(row);
      });
      status = t('ref.mirror', { k });
    } else {
      const k = refl.s / 2 + 1;
      list = stages[k - 1];
      const half = list.length / 2;
      list.forEach((c, i) => {
        if (i === half) {
          const line = document.createElement('div');
          line.className = 'ref-mirror';
          line.textContent = t('ref.mirrorLine');
          frag.append(line);
        }
        frag.append(codeRow(c, true, i));
      });
      status = t(refl.s === last ? 'ref.done' : 'ref.prefix', { k });
    }
    $('refView').replaceChildren(frag);
    $('refStatus').textContent = status;
    const ok = list && list.every((c, i) => c === G.pad(G.toGray(i), c.length));
    $('refCheck').textContent = ok ? t('ref.check', { count: list.length }) : '';
    $('refPrev').disabled = refl.s === 0;
    $('refNext').disabled = refl.s === last;
  }

  function renderHanoi() {
    const total = hanoi.moves.length;
    const pegs = G.hanoiState(hanoi.n, hanoi.moves, hanoi.k);
    const mv = hanoi.k > 0 ? hanoi.moves[hanoi.k - 1] : null;
    const frag = document.createDocumentFragment();
    pegs.forEach((stack, pi) => {
      const peg = document.createElement('div');
      peg.className = 'peg';
      const pole = document.createElement('div');
      pole.className = 'pole';
      for (const d of stack) {
        const disk = document.createElement('div');
        disk.className = `disk${mv && mv.disk === d ? ' moved' : ''}`;
        disk.style.setProperty('--w', String(d / hanoi.n));
        disk.textContent = String(d);
        pole.append(disk);
      }
      const lab = document.createElement('div');
      lab.className = 'peg-label';
      lab.textContent = t(`hanoi.peg${pi}`);
      peg.append(pole, lab);
      frag.append(peg);
    });
    $('hanoiView').replaceChildren(frag);
    const gray = G.pad(G.toGray(hanoi.k), hanoi.n);
    $('hanoiStatus').textContent = !mv
      ? t('hanoi.start', { total, gray })
      : t(hanoi.k === total ? 'hanoi.done' : 'hanoi.status', { k: hanoi.k, total, d: mv.disk, from: t(`hanoi.peg${mv.from}`), to: t(`hanoi.peg${mv.to}`), gray });
    $('hanoiPrev').disabled = hanoi.k === 0;
    $('hanoiNext').disabled = hanoi.k === total;
    const seq = document.createDocumentFragment();
    G.rulerSeq(hanoi.n).forEach((v, i) => {
      const chip = document.createElement('span');
      chip.className = `chip${i + 1 === hanoi.k ? ' now' : ''}`;
      chip.textContent = String(v);
      seq.append(chip);
    });
    $('rulerSeq').replaceChildren(seq);
    const ones = '1'.repeat(hanoi.n);
    $('ringsText').textContent = t('rings.text', { n: hanoi.n, ones, bin: G.grayToBinBits(ones), v: G.ringsMoves(hanoi.n) });
  }

  const clampInt = (raw, lo, hi, fallback) => {
    const x = Math.trunc(Number(raw));
    return !Number.isFinite(x) || String(raw).trim() === '' ? fallback : Math.max(lo, Math.min(hi, x));
  };

  function initHow() {
    $('refBits').addEventListener('change', (e) => {
      refl.n = clampInt(e.target.value, 2, 5, refl.n);
      e.target.value = String(refl.n);
      refl.s = 0;
      renderRefl();
    });
    $('refPrev').addEventListener('click', () => {
      refl.s = Math.max(0, refl.s - 1);
      renderRefl();
    });
    $('refNext').addEventListener('click', () => {
      refl.s = Math.min(2 * (refl.n - 1), refl.s + 1);
      renderRefl();
    });
    $('refReset').addEventListener('click', () => {
      refl.s = 0;
      renderRefl();
    });
    $('hanoiBits').addEventListener('change', (e) => {
      hanoi.n = clampInt(e.target.value, 2, 6, hanoi.n);
      e.target.value = String(hanoi.n);
      hanoi.moves = G.hanoiMoves(hanoi.n);
      hanoi.k = 0;
      renderHanoi();
    });
    $('hanoiPrev').addEventListener('click', () => {
      hanoi.k = Math.max(0, hanoi.k - 1);
      renderHanoi();
    });
    $('hanoiNext').addEventListener('click', () => {
      hanoi.k = Math.min(hanoi.moves.length, hanoi.k + 1);
      renderHanoi();
    });
    $('hanoiReset').addEventListener('click', () => {
      hanoi.k = 0;
      renderHanoi();
    });
    renderRefl();
    renderHanoi();
  }

  // ── セキュリティタブ ──
  const leak = { n: 8, model: 'hd', data: null, chart: null };
  const dip = { n: 4, order: 'binary', k: 0 };

  const fmt2 = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function computeLeak() {
    leak.data = { binary: G.counterLeak(leak.n, 'binary'), gray: G.counterLeak(leak.n, 'gray') };
    leak.chart = null;
  }

  // 観測値を数にする（グラフの棒の高さ）。位置のモデルは反転したビットのうち最上位の位置＋1
  const leakValue = (r) => (leak.model === 'hd' ? r.hd : leak.model === 'hw' ? r.hw : r.top);

  function renderLeakTexts() {
    if (!leak.data) return;
    const total = 1 << leak.n;
    $('leakModelHint').textContent = t(`leak.hint.${leak.model}`);
    const frag = document.createDocumentFragment();
    for (const [key, rows] of [['leak.kindBin', leak.data.binary], ['leak.kindGray', leak.data.gray]]) {
      const sum = G.leakSummary(rows, leak.model);
      const tr = document.createElement('tr');
      const ex = sum.counts.slice(0, 4).map(([obs, c]) => `${leak.model === 'pos' ? `{${obs}}` : obs}→${c.toLocaleString('en-US')}`).join(', ');
      const cells = [t(key), t('leak.distinct', { d: sum.distinct }), t('leak.candidates', { c: fmt2(sum.avgCandidates), total: total.toLocaleString('en-US') }), ex];
      cells.forEach((v, i) => {
        const cell = document.createElement(i ? 'td' : 'th');
        if (!i) cell.scope = 'row';
        cell.textContent = v;
        tr.append(cell);
      });
      frag.append(tr);
    }
    $('leakTbl').querySelector('tbody').replaceChildren(frag);
    $('leakFinding').textContent = t(`leak.found.${leak.model}`);
    $('leakChart').setAttribute('aria-label', t('leak.chartAlt', { model: t(`leak.model.${leak.model}`), max: total - 1 }));
  }

  function resizeLeakChart() {
    const cv = $('leakChart');
    const css = Math.round(cv.getBoundingClientRect().width);
    if (!css || !leak.data) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = Math.round(css * dpr);
    const H = Math.round(220 * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    drawLeakChart();
  }

  // 2段の棒グラフ（上＝2進、下＝グレイ）。横軸は i、棒の高さは観測値 ÷ n
  function drawLeakChart() {
    const cv = $('leakChart');
    if (!cv.width || !leak.data) return;
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const size = 1 << leak.n;
    const gap = Math.round(H * 0.08);
    const stripH = (H - gap) / 2;
    const bw = W / size;
    const strips = [[leak.data.binary, 0, cssVar('--chart-bin')], [leak.data.gray, stripH + gap, cssVar('--chart-gray')]];
    for (const [rows, top, color] of strips) {
      ctx.fillStyle = color;
      for (const r of rows) {
        const h = (leakValue(r) / leak.n) * (stripH - 2);
        ctx.fillRect(r.i * bw, top + stripH - h, Math.max(1, bw * 0.8), h);
      }
      ctx.strokeStyle = cssVar('--border');
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, top + 0.5, W - 1, stripH - 1);
    }
  }

  function setLeakBits(raw) {
    const x = Math.trunc(Number(raw));
    if (!Number.isFinite(x) || String(raw).trim() === '') {
      $('leakBits').value = String(leak.n);
      return;
    }
    leak.n = Math.max(2, Math.min(10, x));
    $('leakBits').value = String(leak.n);
    computeLeak();
    renderLeakTexts();
    resizeLeakChart();
  }

  // スイッチの並び。左から1番、2番…（1番が最上位ビット）。今回切り替えたスイッチに印を付ける
  function renderDip() {
    const n = dip.n;
    const total = 2 ** n;
    const enc = (k) => G.codeOf(k, dip.order);
    const code = enc(dip.k);
    const flips = dip.k > 0 ? new Set(G.diffBits(enc(dip.k - 1), code)) : new Set();
    const frag = document.createDocumentFragment();
    for (let idx = 0; idx < n; idx++) {
      const bit = n - 1 - idx;
      const sw = document.createElement('span');
      sw.className = `dip${(code >>> bit) & 1 ? ' on' : ''}${flips.has(bit) ? ' flip' : ''}`;
      const lab = document.createElement('span');
      lab.className = 'dip-label';
      lab.textContent = String(idx + 1);
      sw.append(lab);
      frag.append(sw);
    }
    $('dipRow').replaceChildren(frag);
    const codeText = G.pad(code, n);
    $('dipStatus').textContent = dip.k === 0
      ? t('dip.statusStart', { total: total.toLocaleString('en-US'), code: codeText })
      : t('dip.status', { k: (dip.k + 1).toLocaleString('en-US'), total: total.toLocaleString('en-US'), code: codeText, now: flips.size, sum: G.flipsUpTo(dip.k, dip.order).toLocaleString('en-US') });
    $('dipPrev').disabled = dip.k === 0;
    $('dipNext').disabled = dip.k === total - 1;
    const tb = document.createDocumentFragment();
    for (const [key, kind] of [['dip.kindBin', 'binary'], ['dip.kindGray', 'gray']]) {
      const all = G.bruteFlips(n, kind);
      const tr = document.createElement('tr');
      const cells = [t(key), t('dip.times', { v: all.toLocaleString('en-US') }), t('dip.per', { v: fmt2(all / Math.max(1, total - 1)) })];
      cells.forEach((v, i) => {
        const cell = document.createElement(i ? 'td' : 'th');
        if (!i) cell.scope = 'row';
        cell.textContent = v;
        tr.append(cell);
      });
      if (kind === dip.order) tr.classList.add('current');
      tb.append(tr);
    }
    $('dipTbl').querySelector('tbody').replaceChildren(tb);
    $('dbText').textContent = t('db.text', {
      n,
      naive: (n * total).toLocaleString('en-US'),
      db: (total + n - 1).toLocaleString('en-US'),
      total: total.toLocaleString('en-US')
    });
    if (n <= 6) {
      const seq = G.deBruijn(n);
      $('dbSeq').textContent = t('db.seq', { n, tail: n - 1, seq: seq + seq.slice(0, n - 1) });
    } else {
      $('dbSeq').textContent = t('db.seqLong', { n, len: total.toLocaleString('en-US') });
    }
  }

  function setDipBits(raw) {
    const x = Math.trunc(Number(raw));
    if (!Number.isFinite(x) || String(raw).trim() === '') {
      $('dipBits').value = String(dip.n);
      return;
    }
    dip.n = Math.max(1, Math.min(16, x));
    $('dipBits').value = String(dip.n);
    dip.k = 0;
    renderDip();
  }

  function initSecurity() {
    $('leakBits').addEventListener('change', (e) => setLeakBits(e.target.value));
    $('leakModel').addEventListener('change', (e) => {
      leak.model = G.LEAK_MODELS.includes(e.target.value) ? e.target.value : 'hd';
      renderLeakTexts();
      drawLeakChart();
    });
    $('dipBits').addEventListener('change', (e) => setDipBits(e.target.value));
    $('dipOrder').addEventListener('change', (e) => {
      dip.order = e.target.value === 'gray' ? 'gray' : 'binary';
      dip.k = 0;
      renderDip();
    });
    $('dipPrev').addEventListener('click', () => {
      if (dip.k > 0) dip.k--;
      renderDip();
    });
    $('dipNext').addEventListener('click', () => {
      if (dip.k < 2 ** dip.n - 1) dip.k++;
      renderDip();
    });
    $('dipReset').addEventListener('click', () => {
      dip.k = 0;
      renderDip();
    });
    const onResize = () => activeTab === 'security' && resizeLeakChart();
    if (window.ResizeObserver) new ResizeObserver(onResize).observe($('leakChart'));
    else window.addEventListener('resize', onResize);
    computeLeak();
    renderLeakTexts();
    renderDip();
  }

  // ── 座学タブ（カードは辞書のキーから作る）──
  const LEARN = {
    learnHistory: ['h.gros', 'h.baudot', 'h.gray'],
    learnUses: ['u.encoder', 'u.bounce', 'u.qam', 'u.karnaugh', 'u.fifo', 'u.adc', 'u.eeprom', 'u.nand', 'u.ga', 'u.light', 'u.puzzle'],
    learnSecurity: ['s.dip', 's.puf', 's.power']
  };
  const MYTHS = ['m.sca', 'm.fault', 'm.ecc', 'm.neighbor', 'm.adc', 'm.bounce'];

  function renderLearn() {
    for (const [id, keys] of Object.entries(LEARN)) {
      const frag = document.createDocumentFragment();
      for (const k of keys) {
        const card = document.createElement('article');
        card.className = 'ucard';
        const h = document.createElement('h4');
        h.textContent = t(`${k}.t`);
        const p = document.createElement('p');
        I.renderRich(p, t(`${k}.p`));
        const src = document.createElement('p');
        src.className = 'source';
        I.renderRich(src, t(`${k}.s`));
        card.append(h, p, src);
        frag.append(card);
      }
      $(id).replaceChildren(frag);
    }
    const ul = document.createDocumentFragment();
    for (const k of MYTHS) {
      const li = document.createElement('li');
      I.renderRich(li, t(k));
      ul.append(li);
    }
    $('learnMyths').replaceChildren(ul);
  }

  // ── 全体 ──
  function renderDynamicTexts() {
    GrayTheme.refresh($('themeToggle'));
    renderSpeed();
    renderValue();
    renderSpinSpeed();
    renderSpinButton();
    disc.lastSector = -1;
    renderReading();
    renderOffsetControls();
    renderSweepTexts();
    renderConvertTexts();
    renderLeakTexts();
    renderDip();
    renderRefl();
    renderHanoi();
    renderLearn();
  }

  function init() {
    I.init();
    initTabs();
    initInfoButtons();
    initBasics();
    initDisc();
    initConvert();
    initSecurity();
    initHow();
    renderLearn();
    const theme = $('themeToggle');
    GrayTheme.refresh(theme);
    theme.addEventListener('click', () => GrayTheme.toggle(theme));
    GrayTheme.watchSystem(theme);
    $('langToggle').addEventListener('click', () => I.set(I.lang === 'ja' ? 'en' : 'ja'));
    GrayTheme.onChange(() => {
      disc.cache = {};
      disc.chart = null;
      if (activeTab === 'disc') drawDiscs();
      if (activeTab === 'security') drawLeakChart();
    });
    I.onChange(renderDynamicTexts);
    const hash = location.hash.slice(1);
    selectTab(TABS.includes(hash) ? hash : 'basics', false);
    booted = true;
    document.documentElement.classList.remove('booting');
  }

  init();
})();
