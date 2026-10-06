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

  // ── センサーのずれ（誤読シミュレーター）──
  // 種つきの乱数（mulberry32）。0以上1未満を返す関数
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const OFFSET_PATTERNS = ['alternate', 'linear', 'random'];

  // リングごとのセンサーのずれ（度）。amount はセクター幅に対する最大の割合（0.1 なら±10%）
  //   alternate: 外側から +a, −a, +a, …  linear: 外側 +a から内側 −a へ等間隔  random: 種つきで −a〜+a
  function sensorOffsets(n, pattern, amount, seed) {
    const N = clampN(n);
    const a = Math.max(0, Number(amount) || 0) * sectorWidth(N);
    const rand = seeded(seed || 1);
    return Array.from({ length: N }, (_, k) => {
      if (pattern === 'linear') return N === 1 ? a : a - (2 * a * k) / (N - 1);
      if (pattern === 'random') return (rand() * 2 - 1) * a;
      return k % 2 ? -a : a;
    });
  }

  // 円周上の距離（セクター数）
  const ringDistance = (a, b, n) => {
    const S = 1 << clampN(n);
    const d = (((a - b) % S) + S) % S;
    return Math.min(d, S - d);
  };

  // ディスクを一周させて、各角度で読んだ値と正しいセクターを比べる
  // 戻り値: { total, exact, adjacent, far, maxErr, worst: [{ truth, read, err, count }]（ずれの大きい順に最大5件）, points: [[phi, read]] }
  function sweep(n, kind, offsets, samplesPerSector) {
    const N = clampN(n);
    const S = 1 << N;
    const sps = Math.max(1, Math.trunc(samplesPerSector || Math.max(8, Math.ceil(4096 / S))));
    const w = 360 / S;
    const res = { total: 0, exact: 0, adjacent: 0, far: 0, maxErr: 0, worst: [], points: [] };
    const seen = new Map();
    for (let i = 0; i < S * sps; i++) {
      const phi = (i + 0.5) * (w / sps);
      const r = readAt(phi, N, kind, offsets);
      const err = ringDistance(r.value, r.sector, N);
      res.total++;
      res.points.push([phi, r.value]);
      if (err === 0) res.exact++;
      else if (err === 1) res.adjacent++;
      else {
        res.far++;
        if (err > res.maxErr) res.maxErr = err;
        const key = `${r.sector}>${r.value}`;
        const hit = seen.get(key);
        if (hit) hit.count++;
        else seen.set(key, { truth: r.sector, read: r.value, err, count: 1 });
      }
    }
    res.worst = [...seen.values()].sort((x, y) => y.err - x.err || x.truth - y.truth).slice(0, 5);
    return res;
  }

  // ── 電力解析のモデル（カウンター）──
  // カウンターを i → i+1（最後の値の次は0）と1つ進めるときに観測できる量を、3つの漏えいモデルで並べる
  //   hd:  反転したビットの数（ハミング距離。Brier, Clavier, Olivier, CHES 2004 のモデル）
  //   hw:  進めたあとの値の1の個数（ハミング重み）
  //   pos: 反転したビットの位置の集合（ビットごとに漏れ方が違うとき。最下位が0、カンマ区切りの文字列）
  const LEAK_MODELS = ['hd', 'hw', 'pos'];
  function counterLeak(n, kind) {
    const N = clampN(n);
    const size = 1 << N;
    const mask = size - 1;
    const rows = [];
    for (let i = 0; i < size; i++) {
      const a = codeOf(i, kind);
      const b = codeOf((i + 1) & mask, kind);
      const pos = diffBits(a, b);
      rows.push({ i, hd: hamming(a, b), hw: popcount(b), pos: pos.join(','), top: Math.max(...pos) + 1 });
    }
    return rows;
  }

  // 観測値ごとの件数と、観測したあとに残る i の候補の数の平均（i は一様に分布すると仮定。Σ件数² ÷ 総数）
  function leakSummary(rows, model) {
    const count = new Map();
    for (const r of rows) count.set(r[model], (count.get(r[model]) || 0) + 1);
    let sq = 0;
    for (const c of count.values()) sq += c * c;
    const counts = [...count.entries()].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0]), 'en', { numeric: true }));
    return { distinct: count.size, avgCandidates: sq / rows.length, counts };
  }

  // ── スイッチの総当たり ──
  // 全 2^n 通りを0から順に試すとき、0から k 番目までに切り替える回数の累計（2進は 2k − popcount(k)、グレイは k）
  const flipsUpTo = (k, kind) => (kind === 'gray' ? k : 2 * k - popcount(k));
  // 全通りを試し終えるまでの切り替え回数（グレイ 2^n−1、2進 2^(n+1)−n−2）
  const bruteFlips = (n, kind) => flipsUpTo(2 ** n - 1, kind);

  // de Bruijn 列 B(2, n)（FKM アルゴリズム）。長さ 2^n の巡回列で、長さ n の窓に n ビットの全パターンが1回ずつ現れる
  function deBruijn(n) {
    const N = Math.max(1, Math.min(16, Math.trunc(n)));
    const a = new Array(N + 1).fill(0);
    const out = [];
    const db = (t, p) => {
      if (t > N) {
        if (N % p === 0) for (let j = 1; j <= p; j++) out.push(a[j]);
      } else {
        a[t] = a[t - p];
        db(t + 1, p);
        for (let j = a[t - p] + 1; j < 2; j++) {
          a[t] = j;
          db(t + 1, t);
        }
      }
    };
    db(1, 1);
    return out.join('');
  }

  // ── しくみ（反射で作る・ルーラー列・ハノイの塔・チャイニーズリング）──
  // 反射で作る各段の列。stages[k] は (k+1) ビットの列（G(1) = [0, 1]、G(k+1) = 0+G(k) と 1+逆順のG(k)）
  function reflectStages(n) {
    const N = Math.max(1, Math.min(MAX_N, Math.trunc(n)));
    const stages = [['0', '1']];
    for (let k = 1; k < N; k++) {
      const prev = stages[k - 1];
      stages.push([...prev.map((c) => `0${c}`), ...[...prev].reverse().map((c) => `1${c}`)]);
    }
    return stages;
  }

  // ルーラー列: グレイコードで k−1 → k のときに反転するビットの位置（下から数えて1始まり）。k = 1〜2^n−1
  const rulerSeq = (n) => Array.from({ length: 2 ** Math.max(1, Math.min(MAX_N, Math.trunc(n))) - 1 }, (_, i) => flipBit(i + 1) + 1);

  // ハノイの塔の最短手順（n 枚、杭 0 から杭 2 へ）。k 手目に動かす円盤は flipBit(k)+1（1が最小）
  // 最小の円盤は一定の向きに巡回し（n が偶数なら 0→1→2、奇数なら 0→2→1）、ほかの手は最小の円盤を動かさない唯一の合法手
  function hanoiMoves(n) {
    const N = Math.max(1, Math.min(10, Math.trunc(n)));
    const pegs = [Array.from({ length: N }, (_, i) => N - i), [], []];
    const dir = N % 2 === 0 ? 1 : 2;
    const moves = [];
    const top = (p) => (pegs[p].length ? pegs[p][pegs[p].length - 1] : Infinity);
    for (let k = 1; k < 2 ** N; k++) {
      const disk = flipBit(k) + 1;
      const from = pegs.findIndex((p) => p.length && p[p.length - 1] === disk);
      let to;
      if (disk === 1) to = (from + dir) % 3;
      else to = [0, 1, 2].find((p) => p !== from && top(p) > disk); // 最小の円盤がある杭は top が1なので外れる
      pegs[from].pop();
      pegs[to].push(disk);
      moves.push({ disk, from, to });
    }
    return moves;
  }

  // ハノイの塔の k 手目まで進めたときの杭の状態
  function hanoiState(n, moves, k) {
    const N = Math.max(1, Math.min(10, Math.trunc(n)));
    const pegs = [Array.from({ length: N }, (_, i) => N - i), [], []];
    for (let j = 0; j < k; j++) pegs[moves[j].to].push(pegs[moves[j].from].pop());
    return pegs;
  }

  // チャイニーズリング: n 個の輪をすべて外すのに必要な最小の手数＝ 11…1（n個）をグレイコードとして2進に直した値
  const ringsMoves = (n) => Number(BigInt('0b' + grayToBinBits('1'.repeat(Math.max(1, Math.min(30, Math.trunc(n)))))));

  globalThis.GrayCore = {
    reflectStages, rulerSeq, hanoiMoves, hanoiState, ringsMoves,
    LEAK_MODELS, counterLeak, leakSummary, flipsUpTo, bruteFlips, deBruijn,
    OFFSET_PATTERNS, seeded, sensorOffsets, ringDistance, sweep,
    MAX_BITS, MAX_STEP_BITS, MIN_N, MAX_N,
    toGray, fromGray, pad, popcount, hamming, clampN,
    normalizeBits, binToGrayBits, grayToBinBits, steps, bitsToDecimal,
    flipBit, diffBits, sequence,
    normAngle, sectorWidth, sectorAt, sectorCenter, codeOf, decode, ringRuns, readAt
  };
})();
