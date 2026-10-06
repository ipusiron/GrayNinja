// GrayNinja の計算部（DOM を使わない）。globalThis.GrayCore に置く
// - 変換はビット列を文字列のまま行う（桁数に上限はあるが、32桁で符号が反転したり固まったりしない）
// - 比較表・エンコーダー・ディスクの読み取りも、ここの関数の戻り値だけから描く
(() => {
  'use strict';

  const MAX_BITS = 1024;      // 変換で受け付ける最大の桁数
  const MAX_STEP_BITS = 64;   // 計算過程を1桁ずつ出す最大の桁数（超えたら結果だけ出す）
  const MIN_N = 1;            // 比較表・ディスクのビット数
  const MAX_N = 12;
  const FW0 = String.fromCharCode(0xff10); // 全角の0
  const FW1 = String.fromCharCode(0xff11); // 全角の1

  // 整数（0〜2^31−1 を想定。表とディスクは12ビットまで）
  const toGray = (b) => (b ^ (b >>> 1)) >>> 0;
  const fromGray = (g) => {
    let b = 0;
    for (let x = g >>> 0; x; x >>>= 1) b ^= x;
    return b >>> 0;
  };
  const pad = (x, n) => (x >>> 0).toString(2).padStart(n, '0');
  const popcount = (x) => {
    let c = 0;
    for (let v = x >>> 0; v; v &= v - 1) c++;
    return c;
  };
  const hamming = (a, b) => popcount((a ^ b) >>> 0);
  const clampN = (n) => Math.max(MIN_N, Math.min(MAX_N, Math.trunc(Number(n)) || MIN_N));

  // 入力の正規化: 全角の0・1と全角空白を半角に、空白・タブ・改行・「_」は区切りとして取り除く、
  // 先頭の 0b / 0B は2進数の接頭辞として取り除く。それ以外の文字はエラー（黙って捨てない）
  // 戻り値: { ok: true, bits } または { ok: false, error: 'empty' | 'tooLong' | 'invalidChar', char, index, length }
  //   index は元の入力での位置（1始まり、コードポイント単位）
  function normalizeBits(input) {
    const chars = Array.from(String(input ?? ''));
    let start = 0;
    // 先頭の空白を飛ばしてから 0b を見る
    while (start < chars.length && /\s/u.test(chars[start])) start++;
    if (chars[start] === '0' && (chars[start + 1] === 'b' || chars[start + 1] === 'B')) start += 2;
    let bits = '';
    for (let i = start; i < chars.length; i++) {
      const c = chars[i];
      if (c === '0' || c === FW0) bits += '0';
      else if (c === '1' || c === FW1) bits += '1';
      else if (c === '_' || /\s/u.test(c)) continue; // \s は全角空白 U+3000 も含む
      else return { ok: false, error: 'invalidChar', char: c, index: i + 1 };
    }
    if (!bits) return { ok: false, error: 'empty' };
    if (bits.length > MAX_BITS) return { ok: false, error: 'tooLong', length: bits.length };
    return { ok: true, bits };
  }

  // ビット列（'0'/'1' の文字列、先頭が最上位）のまま変換する。桁数は変えない
  function binToGrayBits(bits) {
    let out = '';
    for (let i = 0; i < bits.length; i++) out += i === 0 ? bits[0] : String(Number(bits[i - 1]) ^ Number(bits[i]));
    return out;
  }

  function grayToBinBits(bits) {
    let out = '';
    let acc = 0;
    for (const c of bits) {
      acc ^= Number(c);
      out += acc;
    }
    return out;
  }

  // 計算過程（データだけ。文言は画面側で辞書から組み立てる）
  // ビットの添字 j は最下位が0、最上位が n−1。返す配列は最上位から
  //   toGray:  { j, kind: 'msb', b }                        g_j = b_j
  //            { j, kind: 'xor', left: b_{j+1}, right: b_j, out }  g_j = b_{j+1} ⊕ b_j
  //   toBin:   { j, kind: 'msb', g }                        b_j = g_j
  //            { j, kind: 'xor', left: b_{j+1}, right: g_j, out }  b_j = b_{j+1} ⊕ g_j
  function steps(bits, toGrayDir) {
    const n = bits.length;
    const res = toGrayDir ? binToGrayBits(bits) : grayToBinBits(bits);
    const list = [];
    for (let i = 0; i < n; i++) {
      const j = n - 1 - i;
      if (i === 0) list.push({ j, kind: 'msb', value: Number(bits[0]) });
      else list.push({ j, kind: 'xor', left: Number(toGrayDir ? bits[i - 1] : res[i - 1]), right: Number(bits[i]), out: Number(res[i]) });
    }
    return { result: res, steps: list };
  }

  // 2進の文字列を10進の文字列に（BigInt。1,024桁まで）
  const bitsToDecimal = (bits) => BigInt('0b' + bits).toString(10);

  // グレイ符号で i−1 → i のときに反転するビットの位置（最下位が0）。i ≥ 1。ルーラー関数 −1
  function flipBit(i) {
    let p = 0;
    for (let v = i >>> 0; (v & 1) === 0; v >>>= 1) p++;
    return p;
  }

  // 2つの値で違うビットの位置（最下位が0）の配列
  function diffBits(a, b) {
    const out = [];
    for (let x = (a ^ b) >>> 0, p = 0; x; x >>>= 1, p++) if (x & 1) out.push(p);
    return out;
  }

  // 比較表の行。前の値は循環（0 の前は 2^n−1）
  function sequence(n) {
    const N = clampN(n);
    const size = 1 << N;
    const rows = [];
    for (let i = 0; i < size; i++) {
      const prev = (i - 1 + size) % size;
      rows.push({
        i,
        bin: pad(i, N),
        gray: pad(toGray(i), N),
        dBin: hamming(prev, i),
        dGray: hamming(toGray(prev), toGray(i)),
        flipBin: diffBits(prev, i),
        flipGray: diffBits(toGray(prev), toGray(i))
      });
    }
    return rows;
  }

  // ── エンコーダー・ディスク ──
  // ディスクの位置 phi（度）。読み取り線は真上に固定で、位置 phi のときに読み取り線の下にあるのは
  // ディスクの上で角度 phi（真上から時計回り）の点。セクター s は角度 [s·w, (s+1)·w) を占める（w = 360/2^n）
  const normAngle = (a) => ((a % 360) + 360) % 360;
  const sectorWidth = (n) => 360 / (1 << clampN(n));
  const sectorAt = (phi, n) => Math.floor(normAngle(phi) / sectorWidth(n)) % (1 << clampN(n));
  const sectorCenter = (s, n) => (s + 0.5) * sectorWidth(n);
  const codeOf = (s, kind) => (kind === 'gray' ? toGray(s) : s >>> 0);
  const decode = (code, kind) => (kind === 'gray' ? fromGray(code) : code >>> 0);

  // リング k（0 が最上位ビット＝外側）で、同じビットが続くセクターの区間 [start, end) と値
  function ringRuns(n, k, kind) {
    const N = clampN(n);
    const size = 1 << N;
    const shift = N - 1 - k;
    const runs = [];
    let start = 0;
    let cur = (codeOf(0, kind) >>> shift) & 1;
    for (let s = 1; s <= size; s++) {
      const b = s < size ? (codeOf(s, kind) >>> shift) & 1 : -1;
      if (b !== cur) {
        runs.push([start, s, cur]);
        start = s;
        cur = b;
      }
    }
    return runs;
  }

  // 位置 phi で読み取る。offsets[k] はリング k（0＝最上位）のセンサーのずれ（度、省略時は0）
  // 戻り値: { code, value, sector }（sector はずれのない真の位置）
  function readAt(phi, n, kind, offsets) {
    const N = clampN(n);
    let code = 0;
    for (let k = 0; k < N; k++) {
      const s = sectorAt(phi + ((offsets && offsets[k]) || 0), N);
      code |= ((codeOf(s, kind) >>> (N - 1 - k)) & 1) << (N - 1 - k);
    }
    code >>>= 0;
    return { code, value: decode(code, kind), sector: sectorAt(phi, N) };
  }

  globalThis.GrayCore = {
    MAX_BITS, MAX_STEP_BITS, MIN_N, MAX_N,
    toGray, fromGray, pad, popcount, hamming, clampN,
    normalizeBits, binToGrayBits, grayToBinBits, steps, bitsToDecimal,
    flipBit, diffBits, sequence,
    normAngle, sectorWidth, sectorAt, sectorCenter, codeOf, decode, ringRuns, readAt
  };
})();
