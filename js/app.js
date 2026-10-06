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
  const TABS = ['basics', 'disc', 'convert', 'learn'];
  let activeTab = 'basics';

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
    } else {
      stopSpin();
    }
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
  function revealRow(tr) {
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
  const disc = { n: 4, phi: G.sectorCenter(0, 4), spinning: false, last: 0, raf: 0, cache: {}, size: 0, lastSector: -1 };
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
  }

  function renderReading() {
    const n = disc.n;
    const s = G.sectorAt(disc.phi, n);
    const g = G.readAt(disc.phi, n, 'gray');
    const b = G.readAt(disc.phi, n, 'binary');
    $('sectorOut').textContent = t('disc.sectorValue', { s, total: 1 << n });
    $('discGray').textContent = t('disc.readValue', { code: G.pad(g.code, n), v: g.value });
    $('discBinary').textContent = t('disc.readValue', { code: G.pad(b.code, n), v: b.value });
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
    for (const id of ['showNumbers', 'highlightSector']) {
      $(id).addEventListener('change', () => {
        disc.cache = {};
        drawDiscs();
      });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopSpin();
    });
    if (window.ResizeObserver) new ResizeObserver(() => activeTab === 'disc' && resizeDiscs()).observe(document.querySelector('.discs'));
    else window.addEventListener('resize', () => activeTab === 'disc' && resizeDiscs());
    renderSpinSpeed();
    renderSpinButton();
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

  function renderConvertTexts() {
    for (const id of ['binHint', 'grayHint']) $(id).textContent = t('conv.hint', { max: G.MAX_BITS.toLocaleString('en-US') });
    runConvert(true);
    runConvert(false);
  }

  // ── 座学タブ（カードは辞書のキーから作る）──
  const LEARN = {
    learnHistory: ['h.gros', 'h.baudot', 'h.gray'],
    learnUses: ['u.encoder', 'u.qam', 'u.karnaugh', 'u.fifo', 'u.adc', 'u.eeprom', 'u.nand', 'u.ga', 'u.light', 'u.puzzle'],
    learnSecurity: ['s.dip', 's.puf', 's.power']
  };
  const MYTHS = ['m.sca', 'm.fault', 'm.ecc', 'm.neighbor', 'm.adc'];

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
    renderConvertTexts();
    renderLearn();
  }

  function init() {
    I.init();
    initTabs();
    initInfoButtons();
    initBasics();
    initDisc();
    initConvert();
    renderLearn();
    const theme = $('themeToggle');
    GrayTheme.refresh(theme);
    theme.addEventListener('click', () => GrayTheme.toggle(theme));
    GrayTheme.watchSystem(theme);
    $('langToggle').addEventListener('click', () => I.set(I.lang === 'ja' ? 'en' : 'ja'));
    GrayTheme.onChange(() => {
      disc.cache = {};
      if (activeTab === 'disc') drawDiscs();
    });
    I.onChange(renderDynamicTexts);
    const hash = location.hash.slice(1);
    selectTab(TABS.includes(hash) ? hash : 'basics', false);
  }

  init();
})();
