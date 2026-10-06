// style.css の検査（変数の自己参照・定義漏れ・コントラスト・入力の大きさ・余白）
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const css = read('style.css');

// セレクターごとの宣言ブロック（@media の中も、外側の中括弧を外して読む）
function block(selector) {
  const i = css.indexOf(`${selector}{`);
  assert.ok(i >= 0, selector);
  const start = i + selector.length + 1;
  return css.slice(start, css.indexOf('}', start));
}
function tokens(body) {
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const light = tokens(block(':root'));
const darkSaved = tokens(block(':root[data-theme="dark"]'));
const darkOs = tokens(block(':root:not([data-theme="light"])'));

test('変数が自分自身を参照していない（改修前はダークで10個が無効だった）', () => {
  for (const m of css.matchAll(/(--[\w-]+):([^;]+);/g)) assert.ok(!m[2].includes(`var(${m[1]})`), m[1]);
});

test('使っている変数はすべてライトで定義され、ダークの2か所は同じ値', () => {
  for (const m of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(m[1] in light, m[1]);
  assert.deepEqual(darkSaved, darkOs);
  for (const k of Object.keys(darkSaved)) assert.ok(k in light, k);
});

// WCAG 2.2 の相対輝度とコントラスト比
const hex = (h) => {
  const v = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('文字のコントラストが4.5:1以上（ライト・ダーク）', () => {
  const pairs = [
    ['--fg', '--bg'], ['--fg', '--panel'], ['--fg', '--chip'],
    ['--muted', '--bg'], ['--muted', '--panel'], ['--muted', '--chip'],
    ['--accent', '--bg'], ['--accent', '--panel'], ['--accent', '--chip'],
    ['--ok', '--panel'], ['--ok', '--chip'], ['--error', '--panel'], ['--error', '--chip'],
    ['--on-accent', '--accent'], ['--row-active-fg', '--row-active-bg'], ['--mark-fg', '--mark-bg']
  ];
  for (const [name, theme] of [['light', light], ['dark', { ...light, ...darkSaved }]]) {
    for (const [f, b] of pairs) {
      const r = ratio(theme[f], theme[b]);
      assert.ok(r >= 4.5, `${name} ${f} on ${b} = ${r.toFixed(2)}`);
    }
  }
});

test('操作部品の枠・フォーカスの枠・ディスクの色が3:1以上', () => {
  for (const [name, theme] of [['light', light], ['dark', { ...light, ...darkSaved }]]) {
    for (const [f, b] of [['--control-border', '--panel'], ['--control-border', '--chip'], ['--focus', '--bg'], ['--focus', '--panel']]) {
      const r = ratio(theme[f], theme[b]);
      assert.ok(r >= 3, `${name} ${f} on ${b} = ${r.toFixed(2)}`);
    }
  }
  for (const [f, b] of [['--disc-1', '--disc-0'], ['--disc-read', '--disc-0'], ['--disc-highlight', '--disc-1']]) {
    const r = ratio(light[f], light[b]);
    assert.ok(r >= 3, `${f} on ${b} = ${r.toFixed(2)}`);
  }
});

test('入力欄の文字は16px（iOS Safari の自動拡大を防ぐ）、ボタン・タブは高さ44px', () => {
  assert.match(block('input[type="text"],input[type="number"]'), /font-size:16px/);
  assert.match(block('button'), /min-height:44px/);
  assert.match(block('.tab'), /min-height:44px/);
  assert.match(block('label.check'), /min-height:44px/);
});

test('背景や枠のある要素どうしの間は、フォーカスの枠の外側（3px＋2px）より広い', () => {
  const px = (s) => Number((s.match(/(\d+)px/) || [])[1]);
  assert.ok(px(block('.cards').match(/gap:[^;]+/)[0]) > 5);
  assert.ok(px(block('.control-row').match(/gap:[^;]+/)[0]) > 5);
  assert.ok(px(block('.input-row').match(/gap:[^;]+/)[0]) > 5);
  assert.ok(px(block('.box').match(/margin:[^;]+/)[0].split(' ')[2]) > 5);
  assert.match(block(':focus-visible'), /outline:3px solid var\(--focus\)/);
});

test('狭い画面で1カラムになる（ディスク・変換・操作欄）', () => {
  const m980 = css.slice(css.indexOf('@media (max-width:980px)'));
  assert.match(m980, /\.panel-grid,\.twocol\{\s*grid-template-columns:minmax\(0,1fr\)/);
  const m640 = css.slice(css.indexOf('@media (max-width:640px)'));
  assert.match(m640, /\.discs\{\s*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(block('.disc-fig canvas'), /width:100%/);
});
