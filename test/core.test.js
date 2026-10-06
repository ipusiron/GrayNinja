// 計算部（js/gray-core.js）のテスト。期待値は BigInt の参照実装（test/load.js）か、定義から数えた値
import test from 'node:test';
import assert from 'node:assert/strict';
import { core, seeded, refToGray, refFromGray, randomBits } from './load.js';

const G = core();

test('32桁で最上位が1でも、符号が反転したり固まったりしない（改修前は負数・無限ループ）', () => {
  const s = '1' + '0'.repeat(31);
  assert.equal(G.binToGrayBits(s), '11' + '0'.repeat(30));
  assert.equal(G.grayToBinBits(s), '1'.repeat(32));
  assert.equal(G.binToGrayBits('1'.repeat(32)), '1' + '0'.repeat(31));
  assert.equal(G.grayToBinBits('1'.repeat(32)), '10'.repeat(16));
});

test('1〜1,024桁のランダムなビット列で、参照実装と一致し往復で元に戻る', () => {
  const rand = seeded(66);
  const lens = [1, 2, 3, 31, 32, 33, 53, 63, 64, 65, 100, 255, 256, 512, 1023, 1024];
  for (let t = 0; t < 40; t++) lens.push(1 + rand(1024));
  for (const len of lens) {
    const s = randomBits(rand, len);
    const g = G.binToGrayBits(s);
    assert.equal(g, refToGray(s), `toGray len=${len}`);
    assert.equal(G.grayToBinBits(s), refFromGray(s), `fromGray len=${len}`);
    assert.equal(G.grayToBinBits(g), s, `round trip len=${len}`);
    assert.equal(g.length, len);
  }
});

test('先頭の0は桁数ごと保つ', () => {
  assert.equal(G.binToGrayBits('0001'), '0001');
  assert.equal(G.grayToBinBits('0011'), '0010');
  assert.equal(G.binToGrayBits('0'), '0');
});

test('入力の正規化: 区切り・全角・接頭辞は受け付け、それ以外の文字は位置つきのエラー', () => {
  const ok = (input, bits) => assert.deepEqual(G.normalizeBits(input), { ok: true, bits }, JSON.stringify(input));
  ok('1010', '1010');
  ok('1010 1010', '10101010');
  ok('1010_1010', '10101010');
  ok(' 10\t10\n', '1010');
  ok(String.fromCharCode(0xff11, 0xff10, 0xff11, 0xff10), '1010');
  ok('10' + String.fromCharCode(0x3000) + '10', '1010');
  ok('0b1010', '1010');
  ok('0B11', '11');
  ok('  0b1', '1');
  ok('0', '0');
  const bad = (input, char, index) => assert.deepEqual(G.normalizeBits(input), { ok: false, error: 'invalidChar', char, index }, JSON.stringify(input));
  bad('10a1', 'a', 3);
  bad('-1010', '-', 1);
  bad('b101', 'b', 1);
  bad('10b1', 'b', 3);
  bad('1012', '2', 4);
  bad(String.fromCharCode(0xff12), String.fromCharCode(0xff12), 1);
  bad('1\u{1F600}1', '\u{1F600}', 2);
  bad('1.0', '.', 2);
  assert.deepEqual(G.normalizeBits(''), { ok: false, error: 'empty' });
  assert.deepEqual(G.normalizeBits('   '), { ok: false, error: 'empty' });
  assert.deepEqual(G.normalizeBits('0b'), { ok: false, error: 'empty' });
  assert.deepEqual(G.normalizeBits(null), { ok: false, error: 'empty' });
  assert.deepEqual(G.normalizeBits('1'.repeat(G.MAX_BITS)), { ok: true, bits: '1'.repeat(G.MAX_BITS) });
  assert.deepEqual(G.normalizeBits('1'.repeat(G.MAX_BITS + 1)), { ok: false, error: 'tooLong', length: G.MAX_BITS + 1 });
});

test('計算過程: 最上位はそのまま、ほかは隣とのXOR。最後の結果は変換と一致する', () => {
  const a = G.steps('1010', true);
  assert.equal(a.result, '1111');
  assert.deepEqual(a.steps, [
    { j: 3, kind: 'msb', value: 1 },
    { j: 2, kind: 'xor', left: 1, right: 0, out: 1 },
    { j: 1, kind: 'xor', left: 0, right: 1, out: 1 },
    { j: 0, kind: 'xor', left: 1, right: 0, out: 1 }
  ]);
  const b = G.steps('1111', false);
  assert.equal(b.result, '1010');
  assert.deepEqual(b.steps.map((x) => x.out ?? x.value), [1, 0, 1, 0]);
  // Gray→Binary の left は直前に求めたバイナリのビット
  assert.deepEqual(b.steps.slice(1).map((x) => x.left), [1, 0, 1]);
  for (let v = 0; v < 256; v++) {
    const s = G.pad(v, 8);
    assert.equal(G.steps(s, true).result, G.binToGrayBits(s));
    assert.equal(G.steps(s, false).result, G.grayToBinBits(s));
  }
});

test('整数の変換（表とディスク用）', () => {
  for (let v = 0; v < 4096; v++) {
    assert.equal(G.pad(G.toGray(v), 12), refToGray(G.pad(v, 12)));
    assert.equal(G.fromGray(G.toGray(v)), v);
  }
  const rand = seeded(7);
  for (let t = 0; t < 200; t++) {
    const v = rand(2 ** 31);
    assert.equal(G.fromGray(G.toGray(v)), v);
  }
  assert.equal(G.bitsToDecimal('1010'), '10');
  assert.equal(G.bitsToDecimal('1'.repeat(32)), '4294967295');
  assert.equal(G.bitsToDecimal('1' + '0'.repeat(64)), '18446744073709551616');
});

test('比較表: グレイの隣接距離は常に1（巡回も）、2進は末尾の1の個数＋1', () => {
  for (let n = 1; n <= 12; n++) {
    const rows = G.sequence(n);
    assert.equal(rows.length, 2 ** n);
    for (const r of rows) {
      assert.equal(r.dGray, 1, `n=${n} i=${r.i}`);
      assert.equal(r.flipGray.length, 1);
      assert.equal(r.flipBin.length, r.dBin);
      if (r.i > 0) {
        let t = 0;
        for (let x = r.i - 1; x & 1; x >>= 1) t++;
        assert.equal(r.dBin, t + 1);
        assert.equal(r.flipGray[0], G.flipBit(r.i));
      }
    }
    assert.equal(rows[0].dBin, n); // 2^n−1 → 0 は全ビットが変わる
  }
});

test('README の表（4ビット）と同じ値になる', () => {
  const rows = G.sequence(4);
  assert.equal(rows.map((r) => r.gray).join(','), '0000,0001,0011,0010,0110,0111,0101,0100,1100,1101,1111,1110,1010,1011,1001,1000');
  assert.equal(rows.slice(1).map((r) => r.dBin).join(','), '1,2,1,3,1,2,1,4,1,2,1,3,1,2,1');
});

test('全通りを順に巡るときの切り替え回数: グレイは 2^n−1、2進は 2^(n+1)−n−2', () => {
  for (let n = 1; n <= 12; n++) {
    const rows = G.sequence(n).slice(1);
    assert.equal(rows.reduce((a, r) => a + r.dGray, 0), 2 ** n - 1);
    assert.equal(rows.reduce((a, r) => a + r.dBin, 0), 2 ** (n + 1) - n - 2);
  }
  assert.equal(2 ** 13 - 12 - 2, 8178);
});

test('ルーラー関数: 反転するビットの位置は 0,1,0,2,0,1,0,3,…', () => {
  assert.deepEqual(Array.from({ length: 16 }, (_, k) => G.flipBit(k + 1)), [0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4]);
});

test('ディスク: 各セクターの中心と始まりの角度で、そのセクターを読む（角度は360°で巡回）', () => {
  for (let n = 1; n <= 12; n++) {
    const w = G.sectorWidth(n);
    const size = 2 ** n;
    for (let s = 0; s < size; s++) {
      assert.equal(G.sectorAt(G.sectorCenter(s, n), n), s);
      assert.equal(G.sectorAt(s * w, n), s);
      for (const kind of ['gray', 'binary']) {
        const r = G.readAt(G.sectorCenter(s, n), n, kind);
        assert.equal(r.value, s);
        assert.equal(r.code, G.codeOf(s, kind));
      }
    }
    assert.equal(G.sectorAt(-w / 2, n), size - 1);
    assert.equal(G.sectorAt(360 + w / 2, n), 0);
  }
});

test('ディスク: 同じビットが続く区間（描画用）からセクターごとのビットを復元できる', () => {
  for (let n = 1; n <= 12; n++) {
    for (const kind of ['gray', 'binary']) {
      for (let k = 0; k < n; k++) {
        const runs = G.ringRuns(n, k, kind);
        assert.equal(runs[0][0], 0);
        assert.equal(runs[runs.length - 1][1], 2 ** n);
        for (let i = 1; i < runs.length; i++) {
          assert.equal(runs[i][0], runs[i - 1][1]);
          assert.notEqual(runs[i][2], runs[i - 1][2]);
        }
        for (const [a, b, bit] of runs) {
          for (let s = a; s < b; s++) assert.equal((G.codeOf(s, kind) >> (n - 1 - k)) & 1, bit);
        }
      }
    }
  }
});

test('センサーのずれ: グレイは半セクター未満のずれなら隣の値までしか誤らない。2進は遠い値を読む', () => {
  const n = 4;
  const w = G.sectorWidth(n);
  const rand = seeded(2026);
  const dist = (a, b) => Math.min((a - b + 16) % 16, (b - a + 16) % 16);
  for (let trial = 0; trial < 50; trial++) {
    const off = Array.from({ length: n }, () => (rand(1000) / 1000 - 0.5) * 0.98 * w);
    for (let i = 0; i < 16 * 100; i++) {
      const phi = (i + 0.5) * (w / 100);
      const r = G.readAt(phi, n, 'gray', off);
      assert.ok(dist(r.value, r.sector) <= 1, `trial=${trial} phi=${phi}`);
    }
  }
  const off = [0.1 * w, -0.1 * w, 0.05 * w, -0.05 * w];
  let far = 0;
  let maxErr = 0;
  for (let i = 0; i < 16 * 200; i++) {
    const phi = (i + 0.5) * (w / 200);
    const r = G.readAt(phi, n, 'binary', off);
    const d = dist(r.value, r.sector);
    if (d > 1) far++;
    maxErr = Math.max(maxErr, d);
  }
  assert.ok(far > 0);
  assert.equal(maxErr, 8);
});

// ── 誤読シミュレーター（センサーのずれ・一周の集計）──
// 参照実装: 計算部の readAt を使わず、セクターと符号を自前で計算して数える
function refSweep(n, kind, off, sps) {
  const S = 2 ** n;
  const w = 360 / S;
  const gray = (x) => x ^ (x >>> 1);
  const ungray = (g) => {
    let b = 0;
    for (let x = g; x; x >>>= 1) b ^= x;
    return b;
  };
  let far = 0;
  let adjacent = 0;
  let maxErr = 0;
  for (let i = 0; i < S * sps; i++) {
    const phi = (i + 0.5) * (w / sps);
    const truth = Math.floor(phi / w) % S;
    let code = 0;
    for (let k = 0; k < n; k++) {
      const a = (((phi + off[k]) % 360) + 360) % 360;
      const sec = Math.floor(a / w) % S;
      const c = kind === 'gray' ? gray(sec) : sec;
      code |= ((c >> (n - 1 - k)) & 1) << (n - 1 - k);
    }
    const read = kind === 'gray' ? ungray(code) : code;
    const d = Math.min((read - truth + S) % S, (truth - read + S) % S);
    if (d === 1) adjacent++;
    if (d > 1) {
      far++;
      maxErr = Math.max(maxErr, d);
    }
  }
  return { far, adjacent, maxErr };
}

test('センサーのずれ: 3つのずらし方（交互・直線・種つきのランダム）', () => {
  const w = G.sectorWidth(4);
  assert.deepEqual(G.sensorOffsets(4, 'alternate', 0.1).map((x) => +(x / w).toFixed(6)), [0.1, -0.1, 0.1, -0.1]);
  assert.deepEqual(G.sensorOffsets(4, 'linear', 0.3).map((x) => +(x / w).toFixed(6)), [0.3, 0.1, -0.1, -0.3]);
  assert.deepEqual(G.sensorOffsets(1, 'linear', 0.3).map((x) => +(x / G.sectorWidth(1)).toFixed(6)), [0.3]);
  const r1 = G.sensorOffsets(8, 'random', 0.4, 7);
  assert.deepEqual(r1, G.sensorOffsets(8, 'random', 0.4, 7));
  assert.notDeepEqual(r1, G.sensorOffsets(8, 'random', 0.4, 8));
  for (const x of r1) assert.ok(Math.abs(x) <= 0.4 * G.sectorWidth(8));
  assert.ok(G.sensorOffsets(4, 'alternate', 0).every((x) => x === 0));
});

test('一周の集計: ずれがなければ全部正しい。件数の合計は標本数と一致する', () => {
  for (let n = 1; n <= 12; n++) {
    for (const kind of ['gray', 'binary']) {
      const r = G.sweep(n, kind, null);
      assert.equal(r.exact, r.total);
      assert.equal(r.total, r.points.length);
      assert.ok(r.total >= 4096);
    }
  }
  const r = G.sweep(4, 'binary', G.sensorOffsets(4, 'alternate', 0.1), 64);
  assert.equal(r.exact + r.adjacent + r.far, r.total);
  assert.equal(r.total, 16 * 64);
});

test('一周の集計が参照実装と一致する（隣の値・隣より遠い値の件数、最大のずれ）', () => {
  const cases = [[4, 'alternate', 0.1], [4, 'alternate', 0.6], [4, 'linear', 0.9], [8, 'alternate', 0.1], [8, 'random', 0.45], [6, 'random', 1.2]];
  for (const [n, pattern, amount] of cases) {
    const off = G.sensorOffsets(n, pattern, amount, 3);
    for (const kind of ['gray', 'binary']) {
      const r = G.sweep(n, kind, off, 64);
      const ref = refSweep(n, kind, off, 64);
      assert.deepEqual([r.far, r.adjacent, r.maxErr], [ref.far, ref.adjacent, ref.maxErr], `${n} ${pattern} ${amount} ${kind}`);
    }
  }
});

test('グレイは半セクター未満のずれなら隣より遠い値を読まない。超えると読む。2進はわずかなずれでも遠い値を読む', () => {
  for (const n of [2, 3, 4, 6, 8, 10]) {
    for (const pattern of G.OFFSET_PATTERNS) {
      for (const amount of [0.05, 0.25, 0.49]) {
        assert.equal(G.sweep(n, 'gray', G.sensorOffsets(n, pattern, amount, 11)).far, 0, `${n} ${pattern} ${amount}`);
      }
    }
  }
  const g6 = G.sweep(4, 'gray', G.sensorOffsets(4, 'alternate', 0.6), 64);
  assert.ok(g6.far > 0);
  assert.equal(g6.maxErr, 2);
  assert.equal(G.sweep(4, 'binary', G.sensorOffsets(4, 'alternate', 0.1), 64).maxErr, 6);
  assert.equal(G.sweep(8, 'binary', G.sensorOffsets(8, 'alternate', 0.1), 64).maxErr, 86);
  const worst = G.sweep(4, 'binary', G.sensorOffsets(4, 'alternate', 0.1), 64).worst;
  assert.ok(worst.length > 0 && worst.length <= 5);
  for (let i = 1; i < worst.length; i++) assert.ok(worst[i - 1].err >= worst[i].err);
});

// ── 電力解析のモデル・スイッチの総当たり・De Bruijn 列 ──
test('カウンターの漏えい: グレイの反転数は常に1、2進は末尾の1の個数＋1。グレイの反転位置は2進の反転数−1と同じ', () => {
  for (let n = 2; n <= 10; n++) {
    const bin = G.counterLeak(n, 'binary');
    const gray = G.counterLeak(n, 'gray');
    assert.equal(bin.length, 2 ** n);
    for (let i = 0; i < 2 ** n; i++) {
      assert.equal(gray[i].hd, 1);
      assert.equal(bin[i].pos.split(',').length, bin[i].hd);
      assert.equal(gray[i].pos, String(bin[i].hd - 1), `n=${n} i=${i}`);
      assert.equal(gray[i].top, bin[i].top);
      if (i < 2 ** n - 1) {
        let t = 0;
        for (let x = i; x & 1; x >>= 1) t++;
        assert.equal(bin[i].hd, t + 1);
      }
    }
    assert.equal(bin[2 ** n - 1].hd, n); // 最後の値から0へは全ビットが変わる
  }
});

test('観測したあとに残る候補の平均: 式で出した値と一致する', () => {
  const C = (n, k) => {
    let r = 1;
    for (let j = 1; j <= k; j++) r = (r * (n - k + j)) / j;
    return r;
  };
  for (let n = 2; n <= 10; n++) {
    const N = 2 ** n;
    let sq = 4; // 反転数 n は2通り（0111…1 と 111…1）
    for (let k = 1; k < n; k++) sq += 4 ** (n - k);
    const hdBin = sq / N;
    const bin = G.counterLeak(n, 'binary');
    const gray = G.counterLeak(n, 'gray');
    assert.ok(Math.abs(G.leakSummary(bin, 'hd').avgCandidates - hdBin) < 1e-9);
    assert.equal(G.leakSummary(gray, 'hd').avgCandidates, N);
    assert.equal(G.leakSummary(gray, 'hd').distinct, 1);
    assert.ok(Math.abs(G.leakSummary(gray, 'pos').avgCandidates - hdBin) < 1e-9);
    assert.ok(Math.abs(G.leakSummary(bin, 'pos').avgCandidates - hdBin) < 1e-9);
    const hw = C(2 * n, n) / N; // Σ C(n,w)² = C(2n,n)
    assert.ok(Math.abs(G.leakSummary(bin, 'hw').avgCandidates - hw) < 1e-9);
    assert.ok(Math.abs(G.leakSummary(gray, 'hw').avgCandidates - hw) < 1e-9);
    assert.equal(G.leakSummary(gray, 'hw').distinct, n + 1);
  }
  assert.equal(G.leakSummary(G.counterLeak(8, 'binary'), 'hd').avgCandidates.toFixed(2), '85.34');
  assert.equal(G.leakSummary(G.counterLeak(8, 'gray'), 'hw').avgCandidates.toFixed(2), '50.27');
});

test('スイッチの総当たり: 累計の切り替え回数（2k−popcount(k) と k）を1つずつ数えた値と比べる', () => {
  for (const kind of ['binary', 'gray']) {
    let sum = 0;
    for (let k = 1; k < 2 ** 10; k++) {
      sum += G.hamming(G.codeOf(k - 1, kind), G.codeOf(k, kind));
      assert.equal(G.flipsUpTo(k, kind), sum, `${kind} ${k}`);
    }
  }
  assert.equal(G.bruteFlips(12, 'binary'), 8178);
  assert.equal(G.bruteFlips(12, 'gray'), 4095);
  assert.equal(G.bruteFlips(16, 'binary'), 2 ** 17 - 16 - 2);
  assert.equal(G.bruteFlips(1, 'binary'), 1);
  assert.equal(G.bruteFlips(1, 'gray'), 1);
});

test('De Bruijn 列: 長さ 2^n の巡回列で、長さ n の窓に全パターンが1回ずつ現れる', () => {
  assert.equal(G.deBruijn(1), '01');
  assert.equal(G.deBruijn(3), '00010111');
  assert.equal(G.deBruijn(4), '0000100110101111');
  for (let n = 1; n <= 12; n++) {
    const s = G.deBruijn(n);
    assert.equal(s.length, 2 ** n);
    const lin = s + s.slice(0, n - 1);
    const seen = new Set();
    for (let i = 0; i < s.length; i++) seen.add(lin.slice(i, i + n));
    assert.equal(seen.size, 2 ** n, `n=${n}`);
  }
  assert.equal(2 ** 12 + 12 - 1, 4107);
  assert.equal(12 * 2 ** 12, 49152);
});

// ── しくみ（反射で作る・ルーラー列・ハノイの塔・チャイニーズリング）──
test('反射で作った列は、b ⊕ (b ≫ 1) で求めた列と一致する（1〜12ビット）', () => {
  const stages = G.reflectStages(12);
  assert.equal(stages.length, 12);
  for (let k = 1; k <= 12; k++) assert.deepEqual(stages[k - 1], G.sequence(k).map((r) => r.gray), `k=${k}`);
  assert.deepEqual(G.reflectStages(3)[2], ['000', '001', '011', '010', '110', '111', '101', '100']);
});

test('ルーラー列（OEIS A001511 の先頭）', () => {
  assert.deepEqual(G.rulerSeq(5).slice(0, 16), [1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1, 5]);
  assert.equal(G.rulerSeq(6).length, 63);
});

test('ハノイの塔: 2^n−1 手で、どの手も小さい円盤の上に大きい円盤を置かず、k 手目の円盤はルーラー列と一致する', () => {
  for (let n = 1; n <= 8; n++) {
    const moves = G.hanoiMoves(n);
    assert.equal(moves.length, 2 ** n - 1);
    const pegs = [Array.from({ length: n }, (_, i) => n - i), [], []];
    moves.forEach((m, j) => {
      const src = pegs[m.from];
      assert.equal(src[src.length - 1], m.disk, `n=${n} move ${j + 1}`);
      const dst = pegs[m.to];
      assert.ok(!dst.length || dst[dst.length - 1] > m.disk, `n=${n} move ${j + 1}`);
      dst.push(src.pop());
      assert.equal(m.disk, G.flipBit(j + 1) + 1);
    });
    assert.deepEqual(pegs, [[], [], Array.from({ length: n }, (_, i) => n - i)]);
    assert.deepEqual(G.hanoiState(n, moves, moves.length), pegs);
    assert.deepEqual(G.hanoiState(n, moves, 0), [Array.from({ length: n }, (_, i) => n - i), [], []]);
  }
});

test('チャイニーズリング: すべて掛かった n 個の輪を外す最小の手数（偶数なら (2^(n+1)−2)/3、奇数なら (2^(n+1)−1)/3）', () => {
  for (let n = 1; n <= 20; n++) {
    const want = n % 2 === 0 ? (2 ** (n + 1) - 2) / 3 : (2 ** (n + 1) - 1) / 3;
    assert.equal(G.ringsMoves(n), want, `n=${n}`);
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(G.ringsMoves), [1, 2, 5, 10, 21, 42]);
});
