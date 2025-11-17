// terrain_detail_page.js
import { loadTerrainDetailDB, getTerrainDetailByName } from "./13terrain_detail_db";

function fillList(el, items) {
  el.innerHTML = "";
  items.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    el.appendChild(li);
  });
}

(async () => {
  // URLパラメータから ?terrain=自然堤防 みたいなのを取得
  const params = new URLSearchParams(window.location.search);
  const terrainName = params.get("terrain");

  await loadTerrainDetailDB();

  const detail = getTerrainDetailByName(terrainName);
  if (!detail) {
    document.getElementById("terrainTitle").textContent =
      terrainName ? `${terrainName} の詳しい情報はまだ登録されていません` : "地形が指定されていません";
    return;
  }

  document.title = `${detail.terrain_name}の詳しい情報`;
  document.getElementById("terrainTitle").textContent = detail.terrain_name;
  document.getElementById("terrainSubtitle").textContent = detail.subtitle || "";

  fillList(document.getElementById("terrainPoints"), detail.points);
  fillList(document.getElementById("terrainBousai"), detail.bousai);
  fillList(document.getElementById("terrainTourism"), detail.tourism);
  fillList(document.getElementById("terrainEducation"), detail.education);
})();
