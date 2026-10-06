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
  assert.equal(tabs.length, 5);
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
  for (const tab of ['basics', 'disc', 'convert', 'security', 'learn']) used.add(`tab-${tab}`).add(`panel-${tab}`);
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

test('旧版の死にコード（exportData・自己参照の変数を使うクラス）が残っていない', () => {
  assert.ok(!fs.existsSync(new URL('../script.js', import.meta.url)));
  assert.ok(!app.includes('exportData'));
});
