// infoUI.js

export function showLocationInfo({
  terrainType = "不明",
  simpleRisk = { risk: "不明", warnings: "基本的な防災対策を継続してください" },
  // detailedRisk = null, // APIの結果をそのまま渡す
  detailedRisk = { overall_risk: "不明", risk_description: "不明", explanation: "不明" },
  nearestShelter = "情報なし",
  title = "📍 現在地の情報"
}) {
  const currentLocationInfo = document.getElementById("currentLocationInfo");
  const infoCardMessage = document.getElementById("infoCardMessage");

  

  if (infoCardMessage) infoCardMessage.style.display = "none";
  if (currentLocationInfo) currentLocationInfo.style.display = "block";

  // ===== リスクレベル色分け =====
  function getRiskLevel(score) {
    if (score >= 70) return { level: "高", color: "red", emoji: "🔴" };
    if (score >= 40) return { level: "中", color: "orange", emoji: "🟡" };
    return { level: "低", color: "green", emoji: "🟢" };
  }


  let riskHTML = "";

  if (detailedRisk && typeof detailedRisk.overall_risk === "number") {
    // ✅ 精密リスク評価を表示（0〜100）
    const score = detailedRisk.overall_risk;
    const { level, color, emoji } = getRiskLevel(score);

    // detailedRisk.warnings があれば優先、なければ simpleRisk.warnings
    
    riskHTML = `
      <h4>🔎 精密リスク評価（API）</h4>
      <p><strong>・総合リスクスコア:</strong> ${emoji} ${score} / 100 （${level}）</p>
      <p><strong>・説明:</strong> ${detailedRisk.explanation || "情報なし"}</p>
      <p><strong>・詳細:</strong> ${detailedRisk.risk_description || "情報なし"}</p>
    `;
  } else {
    // ⚠️ 簡易リスク評価を表示
    riskHTML = `
      <h4>⚠️ 簡易リスク評価</h4>
      <p><strong>・リスク:</strong> ${simpleRisk.risk}</p>
    `;
  }

  // ★ この地点で「詳しく見る」ボタンを出してよいか
  const canShowDetail =
    terrainType &&
    !["不明", "地形分類データなし", "データ取得エラー"].includes(terrainType);

  const detailBtnHTML = canShowDetail
    ? `
      <button id="terrainDetailBtn"
        style="
          margin-top:8px;
          padding:6px 10px;
          border-radius:6px;
          border:none;
          background:#007bff;
          color:#fff;
          cursor:pointer;
        ">
        🔍 この地形をくわしく見る
      </button>
    `
    : `
      <p style="margin-top:8px; font-size:0.85em; color:#666;">
        ※ この地点の地形詳細ページはまだ登録されていません
      </p>
    `;

  const bodyEl = document.getElementById("infoBody") || currentLocationInfo;
  bodyEl.innerHTML = `
    <div style="padding:12px; background:#fdfdfd; border:1px solid #ddd; border-radius:8px; font-family: sans-serif; line-height:1.6;">
      <h3 style="margin-bottom:10px;">${title}</h3>
      ${riskHTML}
      <p><strong>🗺️ 地形分類:</strong>${terrainType}</p>
      <p><strong>・地形について:</strong> ${simpleRisk.warnings}</p>

      ${detailBtnHTML}

      <p><strong>🏠 最寄避難所:</strong>${nearestShelter}</p>
    </div>
  `;

  // ★ ボタンにページ遷移を設定
  const detailBtn = document.getElementById("terrainDetailBtn");
  if (detailBtn && terrainType && terrainType !== "地形分類データなし" && terrainType !== "データ取得エラー") {
    detailBtn.addEventListener("click", () => {
      const q = encodeURIComponent(terrainType);
      window.location.href = `/terrain.html?terrain=${q}`;
    });
  }
}
