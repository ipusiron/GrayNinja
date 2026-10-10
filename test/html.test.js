// index.html と js/app.js の静的な検査（CSP・インラインの禁止・ARIA・参照する要素の存在）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { read, load } from './load.js';

const html = read('index.html');
const app = read('js/app.js');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const ja = load('js/messages.js').GrayMessages.DICTS.ja;

test('CSP は script・style とも self だけ（unsafe-inline なし）', () => {
  const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m);
  const csp = m[1];
  assert.ok(!csp.includes('unsafe-inline'));
  assert.ok(!csp.includes('unsafe-eval'));
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(d), d);
});

test('style 属性・インラインのイベントハンドラー・インラインのスクリプトがない', () => {
  assert.ok(!/\sstyle="/.test(html));
  assert.ok(!/\son[a-z]+="/i.test(html));
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.ok(/\ssrc="/.test(m[1]), m[0]);
    assert.equal(m[2].trim(), '');
  }
});

test('スクリプトの読み込み順（テーマは描画前、計算部→辞書→言語→テーマ→画面）', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.includes('<script src="js/theme-init.js"></script>'));
  const order = [...html.slice(html.indexOf('</main>')).matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['js/gray-core.js', 'js/messages.js', 'js/i18n.js', 'js/theme.js', 'js/app.js']);
  for (const f of [...order, 'js/theme-init.js', 'style.css', 'assets/favicon.svg']) assert.ok(fs.existsSync(new URL(`../${f}`, import.meta.url)), f);
});

test('新しいタブで開くリンクには rel="noopener noreferrer"', () => {
  for (const m of html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) assert.ok(m[0].includes('rel="noopener noreferrer"'), m[0]);
});

test('タブとパネルが ARIA で結び付いている', () => {
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
  assert.equal(tabs.length, 6);
  for (const tab of tabs) {
    const id = tab.match(/id="([^"]+)"/)[1];
    const panel = tab.match(/aria-controls="([^"]+)"/)[1];
    assert.ok(new RegExp(`<section id="${panel}"[^>]*role="tabpanel"[^>]*aria-labelledby="${id}"`).test(html), panel);
    assert.ok(/aria-selected="(true|false)"/.test(tab));
  }
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
});

test('説明ボタン（?）は開閉する要素を指し、最初は閉じている', () => {
  const btns = [...html.matchAll(/<button[^>]*class="info"[^>]*>/g)].map((m) => m[0]);
  assert.equal(btns.length, 3);
  for (const b of btns) {
    assert.ok(b.includes('aria-expanded="false"'));
    const target = b.match(/aria-controls="([^"]+)"/)[1];
    assert.ok(new RegExp(`id="${target}"[^>]*hidden`).test(html), target);
  }
});

test('アコーディオンは details（キーボードで開閉できる）で、div の見出しボタンはない', () => {
  assert.ok((html.match(/<details class="acc/g) || []).length >= 4);
  assert.ok(!html.includes('accordion-header'));
});

test('ラベルのない入力欄がない', () => {
  for (const m of html.matchAll(/<input([^>]*)>/g)) {
    const attrs = m[1];
    const id = (attrs.match(/id="([^"]+)"/) || [])[1];
    const labelled = attrs.includes('aria-label') || html.includes(`for="${id}"`) || new RegExp(`<label class="check"><input id="${id}"`).test(html);
    assert.ok(labelled, id);
  }
});

test('data-i18n・data-i18n-attr のキーがすべて辞書にある', () => {
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) assert.ok(m[1] in ja, m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of m[1].split(';')) assert.ok(pair.split(':')[1] in ja, pair);
  }
});

test('app.js が参照する要素の id が index.html にある', () => {
  const used = new Set([...app.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]));
  for (const tab of ['basics', 'how', 'disc', 'convert', 'security', 'learn']) used.add(`tab-${tab}`).add(`panel-${tab}`);
  for (const m of app.matchAll(/(?:input|out|value|steps|gray|binary): '([\w-]+)'/g)) used.add(m[1]);
  for (const m of app.matchAll(/^\s+(learn\w+): \[/gm)) used.add(m[1]);
  for (const id of used) assert.ok(ids.has(id), id);
  assert.ok(used.size >= 40);
});

test('app.js は innerHTML・eval・document.write を使わない', () => {
  for (const f of ['js/app.js', 'js/i18n.js', 'js/theme.js', 'js/gray-core.js', 'js/messages.js']) {
    const src = read(f);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(src), f);
  }
});

test('読み込み: 初期化が終わるまで本文を描かず（2秒で必ず出す）、初期化中にレイアウトを強制しない', () => {
  // theme-init.js（head）が booting を付け、app.js の init の最後で外す
  assert.match(read('js/theme-init.js'), /classList\.add\('booting'\)/);
  const init = app.slice(app.indexOf('function init()'), app.lastIndexOf('init();'));
  assert.match(init, /selectTab\(.*\);\n\s*booted = true;\n\s*document\.documentElement\.classList\.remove\('booting'\);\n\s*\}\s*$/);
  // スクリプトが止まっても本文が見えるよう、CSS のアニメーションで2秒後に表示する
  const css = read('style.css');
  assert.match(css, /html\.booting body > \*\{\s*visibility:hidden;\s*animation:boot-show 0s linear 2s forwards;\s*\}/);
  assert.match(css, /@keyframes boot-show\{\s*to\{visibility:visible;\}\s*\}/);
  // 行の位置を読む revealRow は、初期化中と基本のタブが隠れているときは読まない
  const reveal = app.slice(app.indexOf('function revealRow'), app.indexOf('function renderValue'));
  assert.match(reveal, /^function revealRow\(tr\) \{\s*if \(!booted \|\| activeTab !== 'basics'\) return;/);
  // 変換のタブは開いたときに作る
  assert.match(app, /if \(name === 'convert' && convDirty\) renderConvertTexts\(\);/);
});

test('回転の速さは5〜360°/秒（READMEの日英と一致）', () => {
  const m = html.match(/<input id="spinSpeed" type="range" min="(\d+)" max="(\d+)" step="(\d+)" value="(\d+)">/);
  assert.ok(m);
  const [min, max, step, value] = m.slice(1).map(Number);
  assert.deepEqual([min, max, step], [5, 360, 5]);
  assert.ok(value >= min && value <= max && (value - min) % step === 0);
  assert.ok(read('README.md').includes(`速さは${min}〜${max}°/秒`));
  assert.ok(read('README.en.md').includes(`from ${min} to ${max}°/s`));
});

test('旧版の死にコード（exportData・自己参照の変数を使うクラス）が残っていない', () => {
  assert.ok(!fs.existsSync(new URL('../script.js', import.meta.url)));
  assert.ok(!app.includes('exportData'));
});
