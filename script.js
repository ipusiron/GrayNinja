/*
 * ==========================================
 * GrayNinja - Gray Code Learning Tool
 * ==========================================
 * インタラクティブなグレイコード学習ツール
 * 作成: Day066 - 生成AIで作るセキュリティツール100
 * ==========================================
 */

// ==========================================
// ユーティリティ関数
// ==========================================

/**
 * DOMエレメント取得のショートカット
 * @param {string} id - 要素のID
 * @returns {Element} DOM要素
 */
const $ = (id) => document.getElementById(id);

/**
 * 数値を指定ビット数の2進数文字列に変換（前ゼロ埋め）
 * @param {number} x - 変換する数値
 * @param {number} n - ビット数
 * @returns {string} 2進数文字列
 */
const pad = (x, n) => x.toString(2).padStart(n, '0');

/**
 * 2つの整数のハミング距離を計算
 * ハミング距離 = 異なるビット位置の数
 * @param {number} a - 第1の整数
 * @param {number} b - 第2の整数
 * @returns {number} ハミング距離
 */
const hdist = (a, b) => {
  let x = a ^ b; // XORで異なるビットを抽出
  let c = 0;     // カウンタ
  while (x) {
    x &= x - 1;  // Brian Kernighanのアルゴリズム（最下位の1ビットを削除）
    c++;
  }
  return c;
};

// ==========================================
// Gray Code変換アルゴリズム
// ==========================================

/**
 * バイナリからグレイコードに変換
 * 式: G = B ⊕ (B >> 1)
 * @param {number} b - バイナリ値
 * @returns {number} グレイコード値
 */
const binToGray = (b) => (b ^ (b >>> 1));

/**
 * グレイコードからバイナリに変換
 * 累積XOR演算による変換
 * @param {number} g - グレイコード値
 * @returns {number} バイナリ値
 */
const grayToBin = (g) => {
  let b = 0;
  // MSBから順次XOR演算
  for (; g; g >>= 1) {
    b ^= g;
  }
  return b;
};

// ==========================================
// タブナビゲーション
// ==========================================

const tabs = document.querySelectorAll('.tab');
const panels = {
  basics: $('panel-basics'),
  disc: $('panel-disc'),
  convert: $('panel-convert'),
  usecases: $('panel-usecases'),
};

/**
 * タブ切り替え機能の初期化
 * アクティブタブの切り替えと対応パネルの表示制御
 */
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    // 全てのタブとパネルの active クラスを削除
    tabs.forEach(b => b.classList.remove('active'));
    Object.values(panels).forEach(p => p.classList.remove('active'));

    // クリックされたタブとパネルを有効化
    btn.classList.add('active');
    panels[btn.dataset.tab].classList.add('active');

    // エンコーダーディスクタブが選択された場合、遅延レンダリングを実行
    if (btn.dataset.tab === 'disc') {
      renderDiscAll();
    }
  });
});

// ==========================================
// 基本タブ（Basics）
// ==========================================

// グローバル状態変数
let n = 4;              // ビット数
let val = 0;            // 現在の値
let autoplay = null;    // 自動再生タイマー
let autoplaySpeed = 600; // 自動再生速度（ms）

/**
 * ビット数変更時の境界値同期
 * スライダーの最大値とセクター総数を更新
 */
function syncBasicsBounds() {
  const max = (1 << n) - 1; // 2^n - 1
  $('val').max = String(max);
  $('valNum').max = String(max);
  $('sectorsTotal').textContent = String(1 << $('discBits').value);

  // 現在の値が範囲外の場合は調整
  if (val > max) setVal(max);
}

/**
 * 値の設定とバリデーション（セキュリティ強化版）
 * 循環オプションに応じて範囲制限またはラップアラウンドを実行
 * @param {number} v - 設定する値
 */
function setVal(v) {
  // 入力検証とサニタイゼーション
  if (typeof v !== 'number' && typeof v !== 'string') {
    console.warn('Invalid input type for setVal:', typeof v);
    return;
  }

  const numVal = typeof v === 'string' ? parseInt(v, 10) : v;
  if (isNaN(numVal) || !isFinite(numVal)) {
    console.warn('Invalid numeric value for setVal:', v);
    return;
  }

  // DoS対策: 異常に大きな値を拒否
  if (Math.abs(numVal) > Number.MAX_SAFE_INTEGER) {
    console.warn('Value too large for setVal:', numVal);
    return;
  }

  const max = (1 << n) - 1;
  const wrap = $('wrap').checked;

  try {
    if (wrap) {
      // 循環モード: 0〜max の範囲でラップアラウンド
      val = ((numVal % (max + 1)) + (max + 1)) % (max + 1);
    } else {
      // 制限モード: 0〜max の範囲でクランプ
      val = Math.max(0, Math.min(max, Math.floor(numVal)));
    }

    // UI要素の値を同期
    $('val').value = String(val);
    $('valNum').value = String(val);

    // 表示を更新
    renderBasics();
  } catch (error) {
    console.error('Error in setVal:', error);
  }
}

/**
 * 基本タブの表示内容を更新
 * - 現在の値（10進、2進、Gray）
 * - ハミング距離
 * - 比較表の生成とハイライト
 */
function renderBasics() {
  // 現在の値を各形式で表示
  $('decOut').textContent = String(val);
  $('binOut').textContent = pad(val, n);
  $('grayOut').textContent = pad(binToGray(val), n);

  // 次の値とのハミング距離を計算
  const next = (val + 1) & ((1 << n) - 1);
  const grayHamming = hdist(binToGray(val), binToGray(next));
  const binHamming = hdist(val, next);
  $('hdOut').textContent = `Gray=${grayHamming} / Bin=${binHamming}`;

  // 比較表の生成（XSS対策済み）
  const tbody = $('seqTbl').querySelector('tbody');
  tbody.innerHTML = ''; // 既存内容をクリア
  const max = 1 << n;

  for (let i = 0; i < max; i++) {
    const g = binToGray(i);
    const prev = (i - 1 + max) % max;
    const dh = hdist(binToGray(prev), g);
    const isActive = i === val;

    // 安全なDOM操作でXSS脆弱性を防止
    const row = document.createElement('tr');
    row.className = isActive ? 'active' : '';
    row.dataset.index = i.toString();

    // 10進数セル
    const decCell = document.createElement('td');
    decCell.textContent = i.toString();
    row.appendChild(decCell);

    // バイナリセル
    const binCell = document.createElement('td');
    const binCode = document.createElement('code');
    binCode.textContent = pad(i, n);
    binCell.appendChild(binCode);
    row.appendChild(binCell);

    // グレイセル
    const grayCell = document.createElement('td');
    const grayCode = document.createElement('code');
    grayCode.textContent = pad(g, n);
    grayCell.appendChild(grayCode);
    row.appendChild(grayCell);

    // ハミング距離セル
    const hdCell = document.createElement('td');
    hdCell.textContent = dh.toString();
    row.appendChild(hdCell);

    // クリックイベント追加
    row.addEventListener('click', () => {
      setVal(parseInt(row.dataset.index));
    });

    tbody.appendChild(row);
  }

  // アクティブ行へのスムーススクロール
  const activeRow = tbody.querySelector('tr.active');
  if (activeRow) {
    activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * 自動再生速度の動的更新
 * 既存のタイマーを停止して新しい速度で再開
 */
function updateAutoplaySpeed() {
  if (autoplay) {
    clearInterval(autoplay);
    autoplay = setInterval(() => $('next').click(), autoplaySpeed);
  }
}

// ==========================================
// 基本タブ - イベントリスナー
// ==========================================

// ビット数変更（セキュリティ強化版）
$('bits').addEventListener('change', e => {
  const inputVal = e.target.value;
  const numVal = parseInt(inputVal, 10);

  // 入力検証
  if (isNaN(numVal) || !isFinite(numVal)) {
    console.warn('Invalid bit number input:', inputVal);
    e.target.value = n; // 現在の値に戻す
    return;
  }

  // 安全な範囲に制限（1-12ビット）
  const safeBits = Math.max(1, Math.min(12, numVal));
  if (safeBits !== numVal) {
    e.target.value = safeBits; // 修正された値を表示
  }

  n = safeBits;
  syncBasicsBounds();
  renderBasics();
});

// 値変更（スライダー・数値入力）
$('val').addEventListener('input', () => setVal($('val').value | 0));
$('valNum').addEventListener('input', () => setVal($('valNum').value | 0));

// 前の値へ移動
$('prev').addEventListener('click', () => {
  const max = (1 << n);
  if ($('wrap').checked) {
    setVal((val - 1 + max) % max);
  } else {
    setVal(val - 1);
  }
});

// 次の値へ移動
$('next').addEventListener('click', () => {
  const max = (1 << n);
  if ($('wrap').checked) {
    setVal((val + 1) % max);
  } else {
    setVal(val + 1);
  }
});

// 自動再生の開始/停止
$('auto').addEventListener('change', e => {
  if (e.target.checked) {
    if (autoplay) clearInterval(autoplay);
    autoplay = setInterval(() => $('next').click(), autoplaySpeed);
  } else {
    clearInterval(autoplay);
    autoplay = null;
  }
});

// キーボードショートカット
document.addEventListener('keydown', e => {
  // 入力フィールドにフォーカスがある場合は無視
  if (e.target.tagName === 'INPUT') return;

  switch (e.key) {
    case 'ArrowLeft':
      $('prev').click();
      break;
    case 'ArrowRight':
      $('next').click();
      break;
    case ' ':
      e.preventDefault();
      $('auto').checked = !$('auto').checked;
      $('auto').dispatchEvent(new Event('change'));
      break;
  }
});

// ==========================================
// エンコーダーディスクタブ
// ==========================================

let spinTimer = null; // 回転アニメーションのタイマー
let discRotateTimer = null; // ディスク回転アニメーションのタイマー
let discRotationAngle = 0; // ディスクの回転角度（度）

/**
 * 角度からセクター番号を計算
 * 角度0度（上向き）= セクター0になるよう調整
 * @param {number} angle - 角度（0-359、0度=上向き）
 * @param {number} bits - ビット数
 * @returns {number} セクター番号
 */
function sectorFromAngle(angle, bits) {
  const sectors = 1 << bits;
  const step = 360 / sectors;
  // 角度0度（上向き）をセクター0にするため、時計回りでセクター番号を計算
  return Math.floor(angle / step) % sectors;
}

/**
 * CSS変数から色を取得
 * @param {string} varName - CSS変数名（--を除く）
 * @returns {string} 色の値
 */
function getCSSVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${varName}`).trim();
}

/**
 * エンコーダーディスクの描画
 * @param {string} canvasId - Canvas要素のID
 * @param {number} bits - ビット数
 * @param {boolean} isGray - グレイコード=true, バイナリ=false
 * @param {number} rotationAngle - 回転角度（度、デフォルト0）
 */
function drawDisc(canvasId, bits, isGray = true, rotationAngle = 0) {
  const canvas = $(canvasId);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;

  ctx.clearRect(0, 0, W, H);

  // テーマに応じた色を取得
  const bit1Color = getCSSVar('canvas-bit-1');
  const bit0Color = getCSSVar('canvas-bit-0');
  const accentColor = getCSSVar('canvas-accent');
  const borderColor = getCSSVar('canvas-border');
  const errorColor = getCSSVar('canvas-error');

  // 描画パラメータの計算
  const rOuter = Math.min(W, H) / 2 - 20;
  const ringGap = 4;
  const ringWidth = (rOuter - 20 - (bits - 1) * ringGap) / bits;
  const sectors = 1 << bits;
  const showNumbers = $('showNumbers') && $('showNumbers').checked;
  const highlightSector = $('highlightSector') && $('highlightSector').checked;
  const currentSector = sectorFromAngle(currentAngle, bits);

  // リングの描画（外側から内側へ、ビット順）
  for (let k = 0; k < bits; k++) {
    const r1 = rOuter - k * (ringWidth + ringGap);      // 外半径
    const r0 = r1 - ringWidth;                          // 内半径

    // 各セクターの描画
    for (let s = 0; s < sectors; s++) {
      const codeInt = isGray ? binToGray(s) : s;         // グレイ or バイナリ
      const bit = (codeInt >> (bits - 1 - k)) & 1;      // k番目のビット

      // セクターの角度範囲（セクター0が上向き0度から開始）
      const rotationRad = (rotationAngle * Math.PI) / 180; // 度をラジアンに変換
      const a0 = (s / sectors) * 2 * Math.PI - Math.PI / 2 + rotationRad;
      const a1 = ((s + 1) / sectors) * 2 * Math.PI - Math.PI / 2 + rotationRad;

      // セクター形状の描画
      ctx.beginPath();
      ctx.moveTo(cx + r0 * Math.cos(a0), cy + r0 * Math.sin(a0));
      ctx.arc(cx, cy, r0, a0, a1);
      ctx.lineTo(cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1));
      ctx.arc(cx, cy, r1, a1, a0, true);
      ctx.closePath();

      // ビット値に応じた色分け
      ctx.fillStyle = bit ? bit1Color : bit0Color; // 1=白, 0=黒
      ctx.fill();

      // ハイライト処理
      if (highlightSector && s === currentSector) {
        ctx.strokeStyle = accentColor; // アクセントカラー
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();

      // 数字表示オプション
      if (showNumbers && ringWidth > 12) {
        const midAngle = (a0 + a1) / 2;
        const midRadius = (r0 + r1) / 2;
        const textX = cx + midRadius * Math.cos(midAngle);
        const textY = cy + midRadius * Math.sin(midAngle);

        ctx.fillStyle = bit ? bit0Color : bit1Color; // 背景と反対色
        ctx.font = `${Math.min(ringWidth * 0.6, 14)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bit.toString(), textX, textY);
      }
    }
  }

  // 中心マーカー
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.stroke();

  // 読み取り線（上向き）
  ctx.strokeStyle = errorColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - rOuter);
  ctx.stroke();
}

/**
 * エンコーダーディスクの全体更新
 * 角度・ビット数に応じてディスクを描画し、読み取り値を表示
 */
// グローバル角度変数（手動回転ボタンで制御）
let currentAngle = 0;

function renderDiscAll() {
  const bits = Math.max(1, Math.min(12, $('discBits').value | 0));
  const sec = sectorFromAngle(currentAngle, bits);

  // セクター情報の更新
  $('sectorsTotal').textContent = String(1 << bits);
  $('sectorOut').textContent = String(sec);

  // グレイコードディスク
  const grayValue = binToGray(sec);
  $('discGray').textContent = pad(grayValue, bits);
  drawDisc('disc', bits, true, discRotationAngle);

  // バイナリディスク（常時表示）
  $('discBinaryPattern').textContent = pad(sec, bits);
  drawDisc('discBinary', bits, false, discRotationAngle);
}

// ==========================================
// エンコーダーディスク - イベントリスナー
// ==========================================

// ディスクビット数変更（セキュリティ強化版）
$('discBits').addEventListener('change', e => {
  const inputVal = e.target.value;
  const numVal = parseInt(inputVal, 10);

  // 入力検証
  if (isNaN(numVal) || !isFinite(numVal)) {
    console.warn('Invalid disc bit number input:', inputVal);
    e.target.value = 4; // デフォルト値に戻す
    return;
  }

  // 安全な範囲に制限（1-12ビット）
  const safeBits = Math.max(1, Math.min(12, numVal));
  if (safeBits !== numVal) {
    e.target.value = safeBits; // 修正された値を表示
  }

  renderDiscAll();
});

// 手動回転ボタン（前のセクター）
$('prevSector').addEventListener('click', () => {
  const bits = Math.max(1, Math.min(12, $('discBits').value | 0));
  const sectors = 1 << bits;
  const stepAngle = 360 / sectors;
  currentAngle = (currentAngle - stepAngle + 360) % 360;
  renderDiscAll();
});

// 手動回転ボタン（次のセクター）
$('nextSector').addEventListener('click', () => {
  const bits = Math.max(1, Math.min(12, $('discBits').value | 0));
  const sectors = 1 << bits;
  const stepAngle = 360 / sectors;
  currentAngle = (currentAngle + stepAngle) % 360;
  renderDiscAll();
});

// 数字表示切り替え
$('showNumbers').addEventListener('change', renderDiscAll);

// セクターハイライト切り替え
$('highlightSector').addEventListener('change', renderDiscAll);

// ディスク回転開始ボタン
$('discRotateStart').addEventListener('click', () => {
  if (discRotateTimer) clearInterval(discRotateTimer);

  // 固定間隔で実行し、動的に速度を参照
  discRotateTimer = setInterval(() => {
    const speed = parseInt($('discRotateSpeed').value);
    const angleStep = speed / 10; // 角度ステップをスピードに比例
    discRotationAngle = (discRotationAngle + angleStep) % 360;
    renderDiscAll();
  }, 16); // 約60FPSで実行

  $('discRotateStart').disabled = true;
  $('discRotateStop').disabled = false;
});

// ディスク回転停止ボタン
$('discRotateStop').addEventListener('click', () => {
  if (discRotateTimer) {
    clearInterval(discRotateTimer);
    discRotateTimer = null;
  }

  $('discRotateStart').disabled = false;
  $('discRotateStop').disabled = true;
});

// ディスク回転速度変更
$('discRotateSpeed').addEventListener('input', e => {
  $('discRotateSpeedValue').textContent = e.target.value;
  // タイマーは再作成せず、動的に速度値を参照するため何もしない
});

// 回転開始ボタン
$('spinStart').addEventListener('click', () => {
  if (spinTimer) clearInterval(spinTimer);

  // 固定間隔で実行し、動的に速度を参照
  spinTimer = setInterval(() => {
    const speed = parseInt($('spinSpeed').value);
    const angleStep = speed / 25; // 角度ステップをスピードに比例
    currentAngle = (currentAngle + angleStep) % 360;
    renderDiscAll();
  }, 16); // 約60FPSで実行

  $('spinStart').disabled = true;
  $('spinStop').disabled = false;
});

// 回転停止ボタン
$('spinStop').addEventListener('click', () => {
  if (spinTimer) {
    clearInterval(spinTimer);
    spinTimer = null;
  }

  $('spinStart').disabled = false;
  $('spinStop').disabled = true;
});

// 回転速度変更
$('spinSpeed').addEventListener('input', e => {
  $('spinSpeedValue').textContent = e.target.value;
  // タイマーは再作成せず、動的に速度値を参照するため何もしない
});

// ==========================================
// 変換タブ（Convert）
// ==========================================

/**
 * バイナリ/グレイコード相互変換（セキュリティ強化版）
 * @param {string} input - 入力文字列（0と1のみ有効）
 * @param {boolean} toGray - true=グレイ変換, false=バイナリ変換
 * @returns {string} 変換結果
 */
function convert(input, toGray) {
  // 入力検証とサニタイゼーション
  if (typeof input !== 'string') return '—';

  const s = input.replace(/[^01]/g, ''); // 0と1以外を除去
  if (!s) return '—'; // 空文字の場合
  if (s.length > 32) return '—'; // 長すぎる入力を拒否（DoS対策）

  try {
    const num = parseInt(s, 2); // 2進数として解釈
    if (isNaN(num) || num < 0) return '—'; // 不正な値をチェック

    const result = toGray ? binToGray(num) : grayToBin(num);
    return pad(result, s.length); // 元の桁数を保持
  } catch (error) {
    console.error('Conversion error:', error);
    return '—'; // エラー時の安全な戻り値
  }
}

// ==========================================
// 変換タブ - イベントリスナー
// ==========================================

/**
 * Binary → Gray変換の計算過程を生成
 */
function generateBinaryToGraySteps(input) {
  const steps = [];
  const bits = input.split('').map(b => parseInt(b));
  const n = bits.length;

  // ステップ0: 入力表示
  steps.push({
    header: `入力: バイナリ ${input}`,
    calculation: `ビット列: ${bits.map((b, i) => `b${n-1-i}=${b}`).join(', ')}`,
    result: ''
  });

  // 各ビットの計算
  const result = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      // 最上位ビット
      result.push(bits[0]);
      steps.push({
        header: `ステップ${i+1}: 最上位ビット`,
        calculation: `g${n-1} = b${n-1} = ${bits[0]}`,
        result: `g${n-1} = ${bits[0]}`
      });
    } else {
      // 他のビット
      const xor = bits[i-1] ^ bits[i];
      result.push(xor);
      steps.push({
        header: `ステップ${i+1}: ビット${n-1-i}`,
        calculation: `g${n-1-i} = b${n-i} ⊕ b${n-1-i} = ${bits[i-1]} ⊕ ${bits[i]} = ${xor}`,
        result: `g${n-1-i} = ${xor}`
      });
    }
  }

  // 最終結果
  steps.push({
    header: '最終結果',
    calculation: `グレイコード: ${result.join('')}`,
    result: `変換完了: ${input} → ${result.join('')}`
  });

  return steps;
}

/**
 * Gray → Binary変換の計算過程を生成
 */
function generateGrayToBinarySteps(input) {
  const steps = [];
  const bits = input.split('').map(b => parseInt(b));
  const n = bits.length;

  // ステップ0: 入力表示
  steps.push({
    header: `入力: グレイ ${input}`,
    calculation: `ビット列: ${bits.map((b, i) => `g${n-1-i}=${b}`).join(', ')}`,
    result: ''
  });

  // 各ビットの計算
  const result = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      // 最上位ビット
      result.push(bits[0]);
      steps.push({
        header: `ステップ${i+1}: 最上位ビット`,
        calculation: `b${n-1} = g${n-1} = ${bits[0]}`,
        result: `b${n-1} = ${bits[0]}`
      });
    } else {
      // 他のビット
      const xor = result[i-1] ^ bits[i];
      result.push(xor);
      steps.push({
        header: `ステップ${i+1}: ビット${n-1-i}`,
        calculation: `b${n-1-i} = b${n-i} ⊕ g${n-1-i} = ${result[i-1]} ⊕ ${bits[i]} = ${xor}`,
        result: `b${n-1-i} = ${xor}`
      });
    }
  }

  // 最終結果
  steps.push({
    header: '最終結果',
    calculation: `バイナリコード: ${result.join('')}`,
    result: `変換完了: ${input} → ${result.join('')}`
  });

  return steps;
}

/**
 * 計算過程をHTMLに表示（XSS対策済み）
 */
function displaySteps(steps, containerId) {
  const container = $(containerId);
  // 安全なDOM操作でXSS脆弱性を防止
  container.innerHTML = ''; // 既存内容をクリア

  steps.forEach(step => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'step-header';
    headerDiv.textContent = step.header; // XSS安全

    const calcDiv = document.createElement('div');
    calcDiv.className = 'step-calculation';
    calcDiv.textContent = step.calculation; // XSS安全

    stepDiv.appendChild(headerDiv);
    stepDiv.appendChild(calcDiv);

    if (step.result) {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'step-result';
      resultDiv.textContent = step.result; // XSS安全
      stepDiv.appendChild(resultDiv);
    }

    container.appendChild(stepDiv);
  });
}

// Binary → Gray変換
$('toGray').addEventListener('click', () => {
  const input = $('binIn').value;
  const result = convert(input, true);
  $('grayOut2').textContent = result;

  if (/^[01]+$/.test(input)) {
    const steps = generateBinaryToGraySteps(input);
    displaySteps(steps, 'binaryToGraySteps');
  }
});

// Gray → Binary変換
$('toBin').addEventListener('click', () => {
  const input = $('grayIn').value;
  const result = convert(input, false);
  $('binOut2').textContent = result;

  if (/^[01]+$/.test(input)) {
    const steps = generateGrayToBinarySteps(input);
    displaySteps(steps, 'grayToBinarySteps');
  }
});

// Enterキーでの変換実行
$('binIn').addEventListener('keypress', e => {
  if (e.key === 'Enter') $('toGray').click();
});

$('grayIn').addEventListener('keypress', e => {
  if (e.key === 'Enter') $('toBin').click();
});

// ==========================================
// データエクスポート機能
// ==========================================

/**
 * 現在の状態をJSONとしてエクスポート
 * @returns {string} JSON形式の文字列
 */
function exportData() {
  const data = {
    bits: n,
    currentValue: val,
    graySequence: []
  };

  // 全ての値のシーケンスを生成
  for (let i = 0; i < (1 << n); i++) {
    data.graySequence.push({
      decimal: i,
      binary: pad(i, n),
      gray: pad(binToGray(i), n)
    });
  }

  return JSON.stringify(data, null, 2);
}

// ==========================================
// アコーディオン機能
// ==========================================

/**
 * アコーディオンの開閉を切り替え
 */
function toggleAccordion(header) {
  const item = header.closest('.accordion-item');
  const isActive = item.classList.contains('active');

  if (isActive) {
    item.classList.remove('active');
  } else {
    item.classList.add('active');
  }
}

// アコーディオンのイベントリスナー設定
document.addEventListener('DOMContentLoaded', () => {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => toggleAccordion(header));
  });
});

/**
 * 変換タブの初期例表示
 * デフォルト値を使用して計算過程を表示
 */
function initializeConversionExamples() {
  // デフォルト値での Binary → Gray 変換例
  const defaultBinary = "1010";
  const binaryToGraySteps = generateBinaryToGraySteps(defaultBinary);
  displaySteps(binaryToGraySteps, 'binaryToGraySteps');
  $('grayOut2').textContent = convert(defaultBinary, true);

  // デフォルト値での Gray → Binary 変換例
  const defaultGray = "1111";
  const grayToBinarySteps = generateGrayToBinarySteps(defaultGray);
  displaySteps(grayToBinarySteps, 'grayToBinarySteps');
  $('binOut2').textContent = convert(defaultGray, false);
}

/**
 * ライトモード切り替え機能の初期化（セキュリティ強化版）
 */
function initializeThemeToggle() {
  const themeToggle = $('themeToggle');
  const rootElement = document.documentElement;

  // ローカルストレージからテーマ設定を安全に読み込み
  try {
    const savedTheme = localStorage.getItem('theme');
    // 値の検証: 期待される値のみ受け入れ
    if (savedTheme === 'light' || savedTheme === 'dark') {
      if (savedTheme === 'light') {
        rootElement.classList.add('light-mode');
      }
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
    // デフォルトはダークモード
  }

  // テーマ切り替えボタンのクリックイベント
  themeToggle.addEventListener('click', () => {
    try {
      const isLightMode = rootElement.classList.toggle('light-mode');

      // ローカルストレージに安全に保存
      const themeValue = isLightMode ? 'light' : 'dark';
      localStorage.setItem('theme', themeValue);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
      // ローカルストレージが使用できない場合でも動作を継続
    }
  });
}

// ==========================================
// 初期化処理
// ==========================================

/**
 * アプリケーションの初期化
 * - 基本タブとエンコーダーディスクの初期描画
 * - 速度調整スライダーのイベントリスナー設定
 * - 変換タブの初期例表示
 */
function init() {
  // 基本タブの初期化
  syncBasicsBounds();
  renderBasics();

  // エンコーダーディスクの初期化
  renderDiscAll();

  // 速度調整スライダーのイベントリスナー
  $('speedSlider').addEventListener('input', e => {
    autoplaySpeed = parseInt(e.target.value);
    $('speedValue').textContent = `${autoplaySpeed}ms`;
    updateAutoplaySpeed();
  });

  // 変換タブの初期例表示
  initializeConversionExamples();

  // ライトモード切り替えボタンのイベントリスナー
  initializeThemeToggle();
}

// アプリケーション開始
init();