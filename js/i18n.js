// 言語の選択と、HTML に書いた静的な文言（data-i18n・data-i18n-attr）の差し替え。globalThis.GrayI18n に置く
(() => {
  'use strict';

  const STORAGE_KEY = 'grayninja-lang';

  // ?lang= → 保存した選択 → ブラウザーの言語（ja で始まれば日本語、ほかは英語）。辞書にない言語は日本語
  function detectLanguage(search, stored, navigatorLanguage, langs) {
    const list = langs || globalThis.GrayMessages.LANGS;
    const q = new URLSearchParams(search || '').get('lang');
    if (list.includes(q)) return q;
    if (list.includes(stored)) return stored;
    const nav = String(navigatorLanguage || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
    return list.includes(nav) ? nav : 'ja';
  }

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function store(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // 保存できない環境では、そのページの間だけ切り替える
    }
  }

  // 文言を要素へ入れる。**…** は strong、[文字](https://…) は新しいタブで開くリンク、改行は br（HTML として解釈しない）
  const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
  function renderRich(el, text) {
    el.replaceChildren();
    String(text).split('\n').forEach((line, i) => {
      if (i) el.append(document.createElement('br'));
      let last = 0;
      for (const m of line.matchAll(TOKEN)) {
        if (m.index > last) el.append(document.createTextNode(line.slice(last, m.index)));
        if (m[1] !== undefined) {
          const strong = document.createElement('strong');
          strong.textContent = m[1];
          el.append(strong);
        } else {
          const a = document.createElement('a');
          a.href = m[3];
          a.textContent = m[2];
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          el.append(a);
        }
        last = m.index + m[0].length;
      }
      if (last < line.length) el.append(document.createTextNode(line.slice(last)));
    });
  }

  // data-i18n="key" は文言（太字・リンク・改行つき）、data-i18n-attr="attr:key;attr:key" は属性
  function applyStaticText(root = document) {
    for (const el of root.querySelectorAll('[data-i18n]')) renderRich(el, api.t(el.dataset.i18n));
    for (const el of root.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':');
        if (attr && key) el.setAttribute(attr.trim(), api.t(key.trim()));
      }
    }
    document.documentElement.lang = api.lang;
    document.title = api.t('meta.title');
  }

  const listeners = [];
  const api = {
    lang: 'ja',
    detectLanguage,
    renderRich,
    applyStaticText,
    t(key, vars) {
      return globalThis.GrayMessages.t(key, vars, api.lang);
    },
    init() {
      api.lang = detectLanguage(location.search, readStored(), navigator.language);
      applyStaticText();
    },
    set(lang) {
      if (!globalThis.GrayMessages.LANGS.includes(lang)) return;
      api.lang = lang;
      store(lang);
      applyStaticText();
      for (const fn of listeners) fn(lang);
    },
    onChange(fn) {
      listeners.push(fn);
    }
  };

  globalThis.GrayI18n = api;
})();
