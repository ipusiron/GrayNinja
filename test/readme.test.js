// README.md・README.en.md の検査（YAML・構成・画像・書いた事実と計算部の一致・ディレクトリー構造・表記）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, core } from './load.js';

const G = core();
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const DOCS = {
  ja: {
    file: 'README.md', switcher: '[English](README.en.md) · 日本語', day: '**Day066 - 生成AIで作るセキュリティツール100**',
    h1: '# GrayNinja - グレイコードのエンコーダー・ディスク可視化ツール', shots: /^assets\/screenshot[\w-]*\.png$/,
    h2: ['🌐 デモページ', '📸 スクリーンショット', '✨ 特徴', '📖 使い方', '📚 グレイコードの基礎', '🎯 活用例', '🔬 技術的な説明',
      '🔒 セキュリティ', '⚠️ 注意と限界', '🧪 テスト', '🔗 参考文献', '📁 ディレクトリー構造', '💻 動作環境', '📄 ライセンス', '🛠 このツールについて'],
    facts: ['1〜12ビット', '1,024桁', '64桁', '2進`1010`はグレイ`1111`', 'グレイ`1111`は2進`1010`', '2進で26、グレイで15', '2^(n+1)−n−2', '2^n−1',
      '12個で切り替え4,095回', '2進順なら8,178回', '1947年11月13日出願、1953年3月17日登録', '`1000`は値15'],
    forbidden: new RegExp(['ブラウザ(?!ー)', 'フォルダ(?!ー)', 'ディレクトリ(?!ー)', 'リポジトリ(?!ー)', 'サーバ(?!ー)', 'ユーザ(?!ー)',
      '(?<![自0-9０-９])分か(?!れ)', '全て', 'もっとも', '基本情報技術者', 'サイドチャネル攻撃対策を活用', '量子化誤差を最小化', '誤り訂正効率', 'script\\.js'].join('|'))
  },
  en: {
    file: 'README.en.md', switcher: 'English · [日本語](README.md)', day: '**Day066 - 100 Security Tools with Generative AI**',
    h1: '# GrayNinja - Gray Code Encoder Disc Visualization Tool', shots: /^assets\/en\/screenshot[\w-]*\.png$/,
    h2: ['🌐 Demo', '📸 Screenshots', '✨ Features', '📖 How to use', '📚 Gray code basics', '🎯 Use cases', '🔬 Technical notes',
      '🔒 Security', '⚠️ Notes and limitations', '🧪 Tests', '🔗 References', '📁 Directory structure', '💻 Requirements', '📄 License', '🛠 About this tool'],
    facts: ['1 to 12 bits', '1,024 digits', '64 digits', 'binary `1010` becomes Gray `1111`', 'Gray `1111` becomes binary `1010`', '26 in binary and 15 in Gray',
      '2^(n+1)−n−2', '2^n−1', '4,095 flips for 12 switches', '8,178 in binary order', 'filed November 13, 1947; granted March 17, 1953', 'which represents 15'],
    forbidden: /side-channel countermeasure(?!\.)|quantization error is minimized|\bscript\.js\b/i
  }
};
const PROJECT = 'https://akademeia.info/?page_id=42163';
for (const d of Object.values(DOCS)) d.text = read(d.file);

const noCode = (md) => md.replace(/```[\s\S]*?```/g, '');
const headings = (md) => noCode(md).split('\n').filter((l) => /^#{1,4} /.test(l));
const h2 = (md) => headings(md).filter((l) => l.startsWith('## ')).map((l) => l.slice(3));

function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}\n`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）。YAML は README.md だけに置く', () => {
  const m = DOCS.ja.text.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML block');
  const keys = [...m[1].matchAll(/^([a-z_]+):/gm)].map((x) => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en',
    'category_ja', 'category_en', 'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) assert.match(m[1], new RegExp(`^${k}:\\n  - `, 'm'), k);
  assert.match(m[1], /^id: day066$/m);
  assert.match(m[1], /^slug: GrayNinja$/m);
  assert.match(m[1], /^repo_url: "https:\/\/github.com\/ipusiron\/GrayNinja"$/m);
  assert.match(m[1], /^demo_url: "https:\/\/ipusiron.github.io\/GrayNinja\/"$/m);
  assert.match(m[1], /^hub: true$/m);
  assert.doesNotMatch(DOCS.en.text, /^<!--\n---/);
});

test('冒頭の形（言語の切り替え・H1・バッジ5種・Dayの行）と、H2の並び。日英で見出しの数と階層がそろう', () => {
  for (const d of Object.values(DOCS)) {
    assert.ok(d.text.includes(`\n${d.switcher}\n`) || d.text.startsWith(`${d.switcher}\n`), d.file);
    assert.ok(d.text.includes(`\n${d.h1}\n`), d.file);
    assert.ok(d.text.includes(`\n${d.day}\n`), d.file);
    for (const b of ['stars', 'forks', 'last-commit', 'license', 'GitHub%20Pages']) assert.ok(d.text.includes(b), `${d.file} ${b}`);
    assert.deepEqual(h2(d.text), d.h2, d.file);
    assert.ok(d.text.includes(`🔗 [${PROJECT}](${PROJECT})`), d.file);
  }
  const level = (md) => headings(md).map((l) => l.match(/^#+/)[0].length);
  assert.deepEqual(level(DOCS.en.text), level(DOCS.ja.text));
});

test('画像: README から参照する画像はすべて実在し300KB以下。assets の PNG は README から参照されているものだけ', () => {
  for (const d of Object.values(DOCS)) {
    const refs = [...d.text.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
    assert.equal(refs.length, 4, d.file);
    for (const r of refs) {
      assert.match(r, d.shots, r);
      assert.ok(fs.statSync(path.join(ROOT, r)).size <= 300 * 1024, r);
    }
    const dir = d.file === 'README.md' ? 'assets' : 'assets/en';
    const pngs = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`).sort();
    assert.deepEqual(pngs, [...refs].sort(), dir);
  }
});

test('README に書いた事実が載り、計算部と合う', () => {
  for (const d of Object.values(DOCS)) for (const f of d.facts) assert.ok(d.text.includes(f), `${d.file}: ${f}`);
  assert.equal(G.MIN_N, 1);
  assert.equal(G.MAX_N, 12);
  assert.equal(G.MAX_BITS, 1024);
  assert.equal(G.MAX_STEP_BITS, 64);
  assert.equal(G.binToGrayBits('1010'), '1111');
  assert.equal(G.grayToBinBits('1111'), '1010');
  const rows4 = G.sequence(4).slice(1);
  assert.equal(rows4.reduce((a, r) => a + r.dBin, 0), 26);
  assert.equal(rows4.reduce((a, r) => a + r.dGray, 0), 15);
  const rows12 = G.sequence(12).slice(1);
  assert.equal(rows12.reduce((a, r) => a + r.dGray, 0), 4095);
  assert.equal(rows12.reduce((a, r) => a + r.dBin, 0), 8178);
  assert.equal(G.fromGray(0b1000), 15);
});

test('README の4ビットの比較表が計算部の出力と一致する（日英）', () => {
  for (const d of Object.values(DOCS)) {
    const rows = [...d.text.matchAll(/^\| (\d+) \| ([01]{4}) \| ([01]{4}) \| (\d) \| (\d) \|$/gm)].map((m) => m.slice(1).join(' '));
    const want = G.sequence(4).map((r) => [r.i, r.bin, r.gray, r.dBin, r.dGray].join(' '));
    assert.deepEqual(rows, want, d.file);
  }
});

test('README の計算過程の例が計算部の steps と一致する', () => {
  const b2g = G.steps('1010', true).steps;
  const g2b = G.steps('1111', false).steps;
  const sub = (n) => String(n).replace(/\d/g, (x) => '₀₁₂₃₄₅₆₇₈₉'[x]);
  for (const d of Object.values(DOCS)) {
    for (const s of b2g) {
      const line = s.kind === 'msb' ? `g${sub(s.j)} = b${sub(s.j)} = ${s.value}` : `g${sub(s.j)} = b${sub(s.j + 1)} ⊕ b${sub(s.j)} = ${s.left} ⊕ ${s.right} = ${s.out}`;
      assert.ok(d.text.includes(line), `${d.file}: ${line}`);
    }
    for (const s of g2b) {
      const line = s.kind === 'msb' ? `b${sub(s.j)} = g${sub(s.j)} = ${s.value}` : `b${sub(s.j)} = b${sub(s.j + 1)} ⊕ g${sub(s.j)} = ${s.left} ⊕ ${s.right} = ${s.out}`;
      assert.ok(d.text.includes(line), `${d.file}: ${line}`);
    }
    assert.ok(d.text.includes('n=3: 000, 001, 011, 010, 110, 111, 101, 100'));
    assert.equal(G.sequence(3).map((r) => r.gray).join(', '), '000, 001, 011, 010, 110, 111, 101, 100');
  }
});

function files(dir = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['.git', '.claude', 'node_modules'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(`${rel}/`, ...files(rel));
    else out.push(rel);
  }
  return out;
}

test('ディレクトリー構造: すべてのファイルとディレクトリーが載り、すべての行に説明がある', () => {
  const all = files();
  for (const d of Object.values(DOCS)) {
    const tree = d.text.match(/```text\nGrayNinja\/\n([\s\S]*?)```/)[1].split('\n').filter(Boolean);
    const listed = [];
    const stack = [];
    for (const line of tree) {
      const m = line.match(/^((?:│   |    )*)[├└]── (\S+?)(\/?)(?:\s+#\s+\S.*)?$/);
      assert.ok(m, `${d.file}: ${line}`);
      const depth = m[1].length / 4;
      stack.length = depth;
      stack.push(m[2] + m[3]);
      listed.push(stack.join(''));
      if (m[3] !== '/') assert.match(line, /#\s+\S/, `${d.file}: ${line}`);
    }
    assert.deepEqual([...listed].sort(), [...all].sort(), d.file);
  }
});

test('表記: 禁止語がない。強調は1節に2カ所まで、箇条書きの先頭を太字にしない。日本語と英数字のあいだに半角空白を入れない', () => {
  for (const d of Object.values(DOCS)) {
    const body = noCode(d.text);
    assert.doesNotMatch(body, d.forbidden, d.file);
    for (const h of d.h2) {
      const n = (section(body, h).match(/\*\*/g) || []).length / 2;
      assert.ok(n <= 2, `${d.file} ${h}: ${n}`);
    }
    assert.doesNotMatch(body, /^\s*- \*\*/m, d.file);
  }
  const J = '[\\u3040-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef]';
  const bad = new RegExp(`${J} [A-Za-z0-9(\`]|[A-Za-z0-9)\`] ${J}`);
  for (const line of noCode(DOCS.ja.text).split('\n')) {
    if (line.startsWith('MIT License')) continue;
    assert.doesNotMatch(line, bad, line);
  }
});

test('リンクは https で、参考文献に特許の原本と Knuth がある', () => {
  for (const d of Object.values(DOCS)) {
    for (const m of d.text.matchAll(/\]\((https?:[^)]+)\)/g)) assert.ok(m[1].startsWith('https://'), m[1]);
    const refs = section(d.text, d.h2[10]);
    assert.ok(refs.includes('https://patents.google.com/patent/US2632058A/en'));
    assert.ok(refs.includes('https://www-cs-faculty.stanford.edu/~knuth/fasc2a.ps.gz'));
  }
});
