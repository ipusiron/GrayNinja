// 描画の前に、保存したテーマ（light・dark）を当てる。保存がなければ OS の設定に従う（data-theme を付けない）
// あわせて booting を付け、app.js の初期化（文言の差し込み）が終わるまで本文を描かない（style.css）
(() => {
  document.documentElement.classList.add('booting');
  try {
    const saved = localStorage.getItem('grayninja-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch {
    // 保存を読めない環境では OS の設定に従う
  }
})();
