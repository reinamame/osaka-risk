// Location.js
import { map, L } from "./1map_layer.js";
import { updateCurrentLocationInfo } from "./7current_UI.js";

let marker = null;

const OSAKA_BOUNDS = { latMin: 34.2, latMax: 34.9, lngMin: 135.0, lngMax: 135.7 };
const OSAKA_CENTER = [34.6937, 135.5023];

// 現在地取得 or 任意地点クリック時の共通処理
export async function showLocation(lat, lng) {
  if (!marker) {
    marker = L.marker([lat, lng]).addTo(map);
  } else {
    marker.setLatLng([lat, lng])
  }
  marker.openPopup();

  await updateCurrentLocationInfo(lat, lng);
}

export function setupLocationFeatures() {
  // 右上の現在地ボタン
  const locateControl = L.control({ position: "topright" });
  locateControl.onAdd = () => {
    const btn = L.DomUtil.create("button", "locate-button");
    btn.type = "button";
    btn.title = "現在地に戻る";
    btn.textContent = "📍現在地";

    L.DomEvent.disableClickPropagation(btn);
    L.DomEvent.disableScrollPropagation(btn);

    
    
    btn.onclick = () => {
      window.__infoSource = "current";
      map.locate({ setView: false, maxZoom: 16 });
    };
    
    return btn;
  };
  locateControl.addTo(map);

  // 現在地取得イベント
  map.on("locationfound", async(e) => {
    if (window.__infoSource !== "current") {
      console.log("[locationfound] スキップ（モード:", window.__infoSource, "）");
      return;
    }

    const { lat, lng } = e.latlng;
    const inOsaka =
      lat >= OSAKA_BOUNDS.latMin && lat <= OSAKA_BOUNDS.latMax &&
      lng >= OSAKA_BOUNDS.lngMin && lng <= OSAKA_BOUNDS.lngMax;
        
    
    if (inOsaka) {
      map.setView([lat, lng], 16); // 現在地に移動
      await showLocation(lat, lng);
    } else {
      alert("現在地は大阪府の範囲外です。大阪の地図を表示します。");
      // 大阪府中心座標（例：大阪市中心）
      map.setView(OSAKA_CENTER, 13, { animate: false });
    }
  });

  map.on("locationerror", () => {
    alert("現在地取得に失敗したため大阪中心を表示します。");
    map.setView(OSAKA_CENTER, 13, { animate: false });
    });

  // ページロード時にも現在地取得
  if (window.__infoSource === "current") {
    map.locate({ setView: false, maxZoom: 16 });
  }
}
