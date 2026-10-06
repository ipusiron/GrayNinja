// 画面と同じ通常のスクリプト（js/*.js）を、テストの実行環境に読み込む。
// vm.runInThisContext で読むので、結果のオブジェクトはテスト側と同じ realm になる（deepStrictEqual で比べられる）
import fs from 'node:fs';
import vm from 'node:vm';

export const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const loaded = new Set();
export function load(file) {
  if (!loaded.has(file)) {
    vm.runInThisContext(read(file), { filename: file });
    loaded.add(file);
  }
  return globalThis;
}

export const core = () => load('js/gray-core.js').GrayCore;

// 種つきの乱数（mulberry32）。randInt(n) は 0〜n-1
export function seeded(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (n) => Math.floor(next() * n);
}

// 参照実装（BigInt。計算部の文字列の実装とは別の方法で期待値を出す）
export function refToGray(bits) {
  const v = BigInt('0b' + bits);
  return (v ^ (v >> 1n)).toString(2).padStart(bits.length, '0');
}
export function refFromGray(bits) {
  let v = BigInt('0b' + bits);
  let b = 0n;
  while (v) {
    b ^= v;
    v >>= 1n;
  }
  return b.toString(2).padStart(bits.length, '0');
}
export function randomBits(rand, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += rand(2) ? '1' : '0';
  return s;
}
