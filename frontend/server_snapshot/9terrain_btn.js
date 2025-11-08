// 9terrain_btn.js

import { getTerrainMode, setTerrainMode, showCurrentLocationInfo } from "./7current_UI.js";

export function setupTerrainToggle(btnId, infoCardId) {
  const btn = document.getElementById(btnId);
  const infoCard = document.getElementById(infoCardId);
  const infoCardMessage = document.getElementById("infoCardMessage");
  if (!btn || !infoCard || !infoCardMessage) return;

  // 初期表示（現在地モード前提）
  btn.textContent = "📌 他の場所の災害リスクを判定";
  btn.style.background = "#28a745";

  btn.addEventListener("click", async () => {
    if (!getTerrainMode()) {
      // ===== 任意地点クリックモード ON =====
      setTerrainMode(true);
      window.__infoSource = "manual";  // ★ 現在地の上書きを止める

      btn.textContent = "📌 現在地の情報に戻る";
      btn.style.background = "#dc3545";

      infoCardMessage.textContent = "地図上の任意の場所をクリックして地形を判別してください";
      infoCard.style.background = "#fff3cd";
      infoCard.style.borderColor = "#ffeaa7";
    } else {
      // ===== 現在地モードに戻す =====
      setTerrainMode(false);
      window.__infoSource = "current"; // ★ 現在地の上書きを再開

      btn.textContent = "📌 他の場所の災害リスクを判定";
      btn.style.background = "#28a745";

      infoCard.style.background = "#f9f9f9";
      infoCard.style.borderColor = "#ccc";

      // 現在地情報を再表示（7current_UI.js 側で最後の現在地を使う想定）
      await showCurrentLocationInfo();
    }
  });
}
