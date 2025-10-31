// =====  凡例のUI構築（HTML + スタイル） =====

export function initializeLegend(map) {
  const legendDiv = L.DomUtil.create("div", "legend-toggle");
  legendDiv.innerHTML = `
    <div id="legendContent" style="
        display: none;
        position: absolute;
        bottom: 100px;
        right: 10px;
        background: white;
        padding: 10px;
        border: 1px solid #999;
        width: 300px;
        max-height: 320px;
        overflow-y: auto;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        z-index: 1000;
    ">
        <!-- 凡例切り替えボタン -->
        <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
            <button id="showLandLegend" class="legend-button">土地条件図</button>
            <button id="showTsunamiLegend" class="legend-button">津波・洪水</button>
            <button id="showLandslideLegend" class="legend-button">土石流警戒</button>
        </div>

        <!-- 凡例画像表示コンテナ -->
        <div id="resizableContainer" style="display: none;">
            <img id="landLegendImg" style="width: 280px;" src="../JS/8legend/land-legend.png" alt="土地条件図凡例">
            <img id="tsunamiLegendImg" style="width: 280px; display: none;" src="https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/img/shinsui_legend3.png" alt="津波・洪水浸水想定図凡例">
            <img id="landslideLegendImg" style="width: 280px; display: none;" src="https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/copyright/img/keikai_dosekiryu.png" alt="土石流警戒図凡例">
        </div>
    </div>

    <!-- 凡例表示切替ボタン -->
    <button id="toggleLegend" style="
        position: absolute;
        bottom: 10px;
        right: 10px;
        z-index: 1001;
        background: #007cba;
        color: white;
        border: none;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
    ">凡例</button>
`;

  // ✅ マップクリックを無効化（これが重要）
  L.DomEvent.disableClickPropagation(legendDiv);
  L.DomEvent.disableScrollPropagation(legendDiv);


// 凡例を地図右下に追加
  const customLegend = L.control({ position: "bottomright" });
  customLegend.onAdd = () => legendDiv;
  customLegend.addTo(map);
  // ===== 6. 凡例パネル開閉・切替処理 =====
  
  // 凡例の表示/非表示を切り替える
  document.getElementById("toggleLegend").addEventListener("click", () => {
    const content = document.getElementById("legendContent")
    const btn = document.getElementById("toggleLegend")
    const isVisible = content.style.display === "block"
  
    content.style.display = isVisible ? "none" : "block"
    btn.textContent = isVisible ? "凡例" : "凡例を隠す"
  })
  
  // 特定の凡例画像だけを表示
  function showLegend(targetId) {
    const elements = ["landLegendImg", "tsunamiLegendImg", "landslideLegendImg"]
    const container = document.getElementById("resizableContainer")
    const buttons = document.querySelectorAll(".legend-button")
  
    container.style.display = "block"
  
    // すべての凡例を非表示にして、指定されたもののみ表示
    elements.forEach((id) => {
      document.getElementById(id).style.display = id === targetId ? "block" : "none"
    })
  
    // ボタンのアクティブ状態を更新
    buttons.forEach((btn) => btn.classList.remove("active"))
    document
      .getElementById(
        "show" +
          targetId
            .replace("Img", "")
            .replace("land", "Land")
            .replace("tsunami", "Tsunami")
            .replace("landslide", "Landslide") +
          "Legend",
      )
      .classList.add("active")
  }
  
  // 各ボタンに画像切替処理をバインド
  document.getElementById("showLandLegend").addEventListener("click", () => showLegend("landLegendImg"))
  document.getElementById("showTsunamiLegend").addEventListener("click", () => showLegend("tsunamiLegendImg"))
  document.getElementById("showLandslideLegend").addEventListener("click", () => showLegend("landslideLegendImg"))
}
  
