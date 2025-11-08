// 11nearestShelter.js（DB版）
import { map, L } from "../1map_layer.js";
import { API_BASE } from "../12auth.js";


let shelterMarker = null;  // 最寄り1件を地図に出す用

// 大阪府の概略範囲（大阪外は呼ばれても null を返す）
const OSAKA_BOUNDS = { latMin: 34.35, latMax: 34.95, lngMin: 135.25, lngMax: 135.85 };
function isInOsaka(lat, lng) {
  return lat >= OSAKA_BOUNDS.latMin && lat <= OSAKA_BOUNDS.latMax &&
         lng >= OSAKA_BOUNDS.lngMin && lng <= OSAKA_BOUNDS.lngMax;
}

/**
 * 近傍の避難所を API から取得（既定1件）
 * 返り値（limit=1時）: { shelter(互換用), name, distance }  distanceは[m]
 * showMarker=true で最寄りにピンを出す
 */
export async function findNearestShelter(lat, lng, showMarker = false, limit = 1) {
  if (!isInOsaka(lat, lng)) {
    console.log("大阪府外なので避難所情報は表示しません");
    return null;
  }

  const url = `${API_BASE}/shelters/nearest?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) return null;

  const top = list[0]; // name / ward / address / lat / lon / distance_km / ...

  // 既存コード互換のため GeoJSON風に整形
  const shelterCompat = {
    properties: {
      名称: top.name,               // 旧コード互換（日本語キー）
      住所: top.address,
      区: top.ward,
      種別: top.type,
      収容人数: top.capacity,
      電話: top.phone,
      開設条件: top.opening_condition
    },
    geometry: { type: "Point", coordinates: [top.lon, top.lat] }
  };

  const distanceM = Math.round((top.distance_km ?? 0) * 1000);

  if (showMarker) {
    if (!shelterMarker) {
      shelterMarker = L.marker([top.lat, top.lon]).addTo(map);
    } else {
      shelterMarker.setLatLng([top.lat, top.lon]);
    }
    shelterMarker
      .bindPopup(`避難所: ${top.name}（約 ${distanceM} m）`)
      .openPopup();
  }

  return { shelter: shelterCompat, name: top.name, distance: distanceM };
}

// 互換のため残す（DB版では事前ロード不要）
export async function initializeShelters() {
  return;
}
