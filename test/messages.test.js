// 辞書（js/messages.js）の検査。言語間のキーと置き場所、リンク、app.js が使うキー
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, load, core } from './load.js';

const M = load('js/messages.js').GrayMessages;
const app = read('js/app.js');
const ja = M.DICTS.ja;

test('文言が空でない', () => {
  for (const [lang, dict] of Object.entries(M.DICTS)) {
    for (const [k, v] of Object.entries(dict)) assert.ok(typeof v === 'string' && v.trim(), `${lang} ${k}`);
  }
});

test('すべての言語で同じキーと同じ置き場所（{name}）を持つ', () => {
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const [lang, dict] of Object.entries(M.DICTS)) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(ja).sort(), lang);
    for (const k of Object.keys(ja)) assert.equal(vars(dict[k]), vars(ja[k]), `${lang} ${k}`);
  }
});

test('リンクは https だけ', () => {
  for (const dict of Object.values(M.DICTS)) {
    for (const [k, v] of Object.entries(dict)) {
      for (const m of v.matchAll(/\]\(([^)]*)\)/g)) assert.ok(/^https:\/\/\S+$/.test(m[1]), `${k} ${m[1]}`);
    }
  }
});

test('置き換え: {name} を値に、ない値は残す', () => {
  assert.equal(M.t('ctl.speedValue', { ms: 600 }, 'ja'), '600ms');
  assert.equal(M.t('ctl.speedValue', {}, 'ja'), '{ms}ms');
  assert.equal(M.t('no.such.key', null, 'ja'), 'no.such.key');
});

test('app.js が使うキーがすべて辞書にある', () => {
  const keys = new Set([...app.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]));
  for (const k of ['err.empty', 'err.tooLong', 'err.invalidChar', 'disc.spin', 'disc.stop', 'kind.bin', 'kind.gray', 'theme.toLight', 'theme.toDark']) keys.add(k);
  const learn = app.slice(app.indexOf('const LEARN'), app.indexOf('function renderLearn'));
  for (const m of learn.matchAll(/'([hus])\.(\w+)'/g)) for (const s of ['t', 'p', 's']) keys.add(`${m[1]}.${m[2]}.${s}`);
  for (const m of learn.matchAll(/'(m\.\w+)'/g)) keys.add(m[1]);
  for (const k of keys) assert.ok(k in ja, k);
  assert.ok(keys.size > 50);
});

test('基本の説明（チャタリング）の数値が計算部と一致する（日英）', () => {
  const G = core();
  assert.equal(2 ** G.hamming(G.toGray(7), G.toGray(8)), 2);
  assert.equal(2 ** G.hamming(7, 8), 16);
  for (let i = 0; i < 4096; i++) assert.equal(G.hamming(G.toGray(i), G.toGray((i + 1) % 4096)), 1, i);
  assert.ok(ja['card.nextTip'].includes('グレイは常に2通りで、4ビットの2進の7 → 8では16通り'));
  assert.ok(M.DICTS.en['card.nextTip'].includes('always 2 for Gray, and 16 for 7 → 8 in 4-bit binary'));
});

test('座学の各カードに出典のリンクがある', () => {
  for (const k of Object.keys(ja).filter((x) => /\.s$/.test(x))) assert.match(ja[k], /\]\(https:\/\//, k);
});

test('日本語の表記（「分かる」は開く、ですます調）', () => {
  for (const [k, v] of Object.entries(ja)) {
    assert.ok(!v.includes('分かる') && !v.includes('分かり'), k);
  }
});

test('日本語の文言で、日本語と英数字のあいだに半角空白を入れない', () => {
  const J = '[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]';
  const bad = new RegExp(`${J} [A-Za-z0-9(\`]|[A-Za-z0-9)\`] ${J}`);
  for (const [k, v] of Object.entries(ja)) assert.doesNotMatch(v, bad, k);
});
