// 言語の選び方（js/i18n.js）
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.js';

const { GrayI18n: I, GrayMessages: M } = load('js/messages.js') && load('js/i18n.js');

test('?lang= → 保存した選択 → ブラウザーの言語の順に決める', () => {
  assert.equal(I.detectLanguage('?lang=en', 'ja', 'ja-JP'), 'en');
  assert.equal(I.detectLanguage('?lang=ja', 'en', 'en-US'), 'ja');
  assert.equal(I.detectLanguage('', 'en', 'ja-JP'), 'en');
  assert.equal(I.detectLanguage('', null, 'ja-JP'), 'ja');
  assert.equal(I.detectLanguage('', null, 'en-US'), 'en');
  assert.equal(I.detectLanguage('', null, 'fr-FR'), 'en');
  assert.equal(I.detectLanguage('?lang=xx', 'yy', ''), 'en');
});

test('日本語と英語の辞書がある', () => {
  assert.deepEqual(M.LANGS, ['ja', 'en']);
  assert.equal(M.t('tab.disc', null, 'en'), 'Disc');
  assert.equal(M.t('tab.disc', null, 'ja'), 'ディスク');
  assert.equal(M.t('err.invalidChar', { char: 'a', index: 3 }, 'en'), 'Character "a" at position 3 is not 0 or 1.');
});

test('英語の文言に日本語の文字が混ざっていない（言語の切り替えボタンを除く）', () => {
  for (const [k, v] of Object.entries(M.DICTS.en)) {
    if (k === 'ui.langButton' || k === 'ui.langLabel') continue;
    assert.ok(!/[\u3040-\u30ff\u4e00-\u9fff]/.test(v), k);
  }
});
