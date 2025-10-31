// ===== mapLayer.js（動作確認用console.log追加版） =====

export const L = window.L  

// ── 追加：静かな JSON フェッチ（404/HTMLをスキップ） ──
window.__DEBUG ??= false;
async function fetchJSONSafe(url, label){
  try{
    const res = await fetch(url, { cache: "no-store", headers: { "Accept": "application/json" } });
    if (!res.ok) { if (window.__DEBUG) console.warn(label, "HTTP", res.status, url); return null; }
    // geojsonを application/octet-streamで返す環境もあるので content-type は警告だけ
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("json")) { if (window.__DEBUG) console.warn(label, "non-JSON:", ct, url); }
    return await res.json();
  } catch (e) {
    if (window.__DEBUG) console.warn(label, "fetch/json error:", e);
    return null;
  }
}


// ベースマップ
export const baseMap = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
});
console.log("baseMap作成完了:", baseMap)

// 地図初期化
export const map = L.map("map", {
  center: [34.6937, 135.5023],
  zoom: 13,
  minZoom: 9,
  maxZoom: 18,
  layers: [baseMap],
});
console.log("map作成完了:", map)

// GeoJSON 読み込み
// ここを差し替え（相対→絶対 & 安全フェッチ）
(async () => {
  const data = await fetchJSONSafe("/data/N03-19_27_190101.geojson", "osaka-geojson");
  if (!data) { console.log("大阪府GeoJSONなし→スキップ"); return; }

  const osakaLayer = L.geoJSON(data, {
    filter: f => f.properties?.N03_007?.startsWith("27"),
    style: { color:"#525252ff", weight:2, fillColor:"#f9f9f2ff", fillOpacity:0.2 }
  }).addTo(map);
  console.log("大阪府GeoJSONレイヤー追加:", osakaLayer);
})();

// ===== 2. 災害関連レイヤー定義 =====
export const landLayer = L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/lcm25k_2012/{z}/{x}/{y}.png", {
  opacity: 0.5,
  attribution: "© 国土地理院",
  maxZoom: 18,
  minZoom: 10,
})
console.log("landLayer作成完了:", landLayer)

export const landslideLayer = L.tileLayer("https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png", {
  opacity: 0.7,
  attribution: "© 国土地理院",
  maxZoom: 18,
  minZoom: 10,
})
console.log("landslideLayer作成完了:", landslideLayer)

export const floodLayer = L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png", {
  opacity: 0.7,
  attribution: "© 国土地理院",
  maxZoom: 18,
  minZoom: 10,
})
console.log("floodLayer作成完了:", floodLayer)

export const tsunamiLayer = L.tileLayer("https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png", {
  opacity: 0.7,
  attribution: "© 国土地理院",
  maxZoom: 18,
  minZoom: 10,
})
console.log("tsunamiLayer作成完了:", tsunamiLayer)

// ===== 3. レイヤーコントロールの追加 =====
export const baseLayers = { 地図: baseMap }
export const overlays = {
  土地条件図: landLayer,
  津波浸水想定区域: tsunamiLayer,
  洪水浸水想定区域: floodLayer,
  土石流警戒区域: landslideLayer,
}
L.control.layers(baseLayers, overlays).addTo(map)
landLayer.addTo(map) // 初期表示レイヤー

console.log("レイヤーコントロール追加完了")
