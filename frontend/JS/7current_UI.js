console.log("7current_UI.js loaded");
import { map, L } from "./1map_layer.js";
import { getTerrainFromAPI } from "./2terrain.js";
import { getDetailedRiskByTerrain, assessDisasterRisk, loadRiskDatabase, fetchRiskFromAPI } from "./4risk.js?v=20251107b";
import { showLocationInfo } from "./6infoUI.js";
import { showLocation } from "./3location.js";
import { setFavoriteButton } from "./10favorite.js";
import { initializeShelters, findNearestShelter } from "./11nearestShelter/11nearestShelter.js";
import { API_BASE } from "./12auth.js";


// === 保存用のグローバル変数 ===
let lastCurrentLocation = null;
let lastCurrentLocationHTML = "";

let terrainMarker = null;
let _isTerrainDetectionMode = false;
let shelterMarker = null; 


// === getter / setter ===
export function getTerrainMode() {
  return _isTerrainDetectionMode;
}

export function setTerrainMode(flag) {
  _isTerrainDetectionMode = flag;
  console.log("任意地点モード:", _isTerrainDetectionMode);

  const infoCardMessage = document.getElementById("infoCardMessage");
  const currentLocationInfo = document.getElementById("currentLocationInfo");

  if (_isTerrainDetectionMode) {
    // 任意地点モードON → 案内文表示、情報カード非表示
    if (infoCardMessage) {
      infoCardMessage.style.display = "block";
      infoCardMessage.textContent = "地図上の任意の場所をクリックしてください";
    }
    if (currentLocationInfo) currentLocationInfo.style.display = "none";

    // マーカーがあれば削除
    if (terrainMarker) {
      map.removeLayer(terrainMarker);
      terrainMarker = null;
    }
  } else {
    // 任意地点モードOFF → 現在地情報を表示
    if (infoCardMessage) infoCardMessage.style.display = "none";
    if (currentLocationInfo) currentLocationInfo.style.display = "block";

    if (terrainMarker) {
      map.removeLayer(terrainMarker);
      terrainMarker = null;
    }

    // 現在地を再取得して infoCard とマーカーを更新
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Location.js の共通関数を利用
        await showLocation(lat, lng);
      }, (err) => {
        console.error("現在地取得失敗:", err);
      });
    }
  }
}

// ====== DBに存在するか確認する関数 ======
async function hasDbMatch(lat, lng) {
  try {
    const response = await fetch(`${API_BASE}/risk?lat=${lat}&lon=${lon}`);
    if (!response.ok) return false;
    const data = await response.json();

    // DBに該当なしの場合、バックエンドで status: "no_match" を返すようにしておく
    if (!data || data.status === "no_match" || data.overall_risk === null) {
      return false;
    }
    return true;
  } catch (e) {
    console.warn("DB存在確認失敗:", e);
    return false;
  }
}



// === 現在地情報更新 ===
export async function updateCurrentLocationInfo(lat, lng) {
  const currentLocationInfo = document.getElementById("currentLocationInfo");
  const infoCardMessage = document.getElementById("infoCardMessage");

  if (infoCardMessage) infoCardMessage.style.display = "none";
  if (currentLocationInfo) currentLocationInfo.style.display = "block";

  try {
    const terrainType = await getTerrainFromAPI(lat, lng);

    // 簡易リスク
    const simpleRisk = getDetailedRiskByTerrain(terrainType)
                    || await assessDisasterRisk(lat, lng, terrainType);

    // 精密リスク（API）
    const detailedRisk = await fetchRiskFromAPI(lat, lng);

    const nearest = await findNearestShelter(lat, lng);
    // const nearestName = nearest ? nearest.shelter.properties.P20_002 : "情報なし";

    const nearestName = nearest
    ? (nearest.name ?? nearest.shelter?.properties?.名称 ?? "情報なし")
    : "情報なし";

    showLocationInfo({ 
      terrainType, 
      simpleRisk,
      detailedRisk,   // showLocationInfo が内部で「精密優先 or 簡易」を判定 
      nearestShelter: nearestName,
      disasterHistory: "未設定", 
      title: "📍 現在地の情報"  
    });


    // お気に入り用（ここも simpleRisk/detailedRisk を分けておくと良い）
    const riskForFavorite = (detailedRisk && typeof detailedRisk.overall_risk === "number")
      ? detailedRisk
      : simpleRisk;


  // この地点情報でボタンを設定
    setFavoriteButton(lat, lng, terrainType, simpleRisk, detailedRisk);
  
  } catch (err) {
    console.warn("現在地情報取得失敗:", err);
  }
}

// === 現在地情報に戻す ===
export async function showCurrentLocationInfo() {
  const infoCard = document.getElementById("infoCard");
  if (!lastCurrentLocation) return;
  
  // マーカーを削除
  if (terrainMarker) {
    map.removeLayer(terrainMarker);
    terrainMarker = null;
  }

  // 任意地点モードOFF
  _isTerrainDetectionMode = false;
  
  // 現在地を再取得して infoCard を更新
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      await updateCurrentLocationInfo(lat, lng);
    }, 
    (err) => {
      console.error("現在地取得失敗:", err);
      // キャッシュがあれば fallback として復元
      if (lastCurrentLocationHTML) {
        infoCard.innerHTML = lastCurrentLocationHTML;
      } else {
        infoCard.innerHTML = "<p>現在地情報を取得できませんでした</p>";
      }
    });
  } else {
    console.warn("Geolocation API が利用できません");
    if (lastCurrentLocationHTML) {
      infoCard.innerHTML = lastCurrentLocationHTML;
    }
  }
}

// === クリック地点の地形判定 ===
function setupMapClickEvent() {
  map.on("click", async (e) => {
    if (!_isTerrainDetectionMode) {
      console.log("任意地点モードOFFなのでクリックは無視");
      return;
    }

    const { lat, lng } = e.latlng;

    if (terrainMarker) map.removeLayer(terrainMarker);
    if (shelterMarker) map.removeLayer(shelterMarker);
    terrainMarker = L.marker([lat, lng]).addTo(map);

    const currentLocationInfo = document.getElementById("currentLocationInfo");
    const infoCardMessage = document.getElementById("infoCardMessage");

    // 任意地点でも infoCard を表示
    if (infoCardMessage) infoCardMessage.style.display = "none";
    if (currentLocationInfo) currentLocationInfo.style.display = "block";

    try {
      const terrainType = await getTerrainFromAPI(lat, lng);

      // 簡易リスク
      const simpleRisk = getDetailedRiskByTerrain(terrainType)
                      || await assessDisasterRisk(lat, lng, terrainType);
      
      // 精密リスク（API）
      const detailedRisk = await fetchRiskFromAPI(lat, lng);

      console.log("判定結果:", terrainType, simpleRisk, detailedRisk);

      const nearest = await findNearestShelter(lat, lng, false);
      // const nearestName = nearest ? nearest.shelter.properties.P20_002 : "情報なし";

      const nearestName = nearest
        ? (nearest.name ?? nearest.shelter?.properties?.名称 ?? "情報なし")
        : "情報なし"; 
        
      // 避難所マーカーを作成
      if (nearest) {
        const walkingMinutes = Math.round(nearest.distance / 80); // 80m/分で換算して四捨五入
        shelterMarker = L.circleMarker([nearest.shelter.geometry.coordinates[1], nearest.shelter.geometry.coordinates[0]], {
          radius: 5,
          color: 'red',
          fillColor: 'red',
          fillOpacity: 0.8
        }).addTo(map)
        .bindPopup(`避難所: ${nearestName} (徒歩${walkingMinutes}分)`)
        .openPopup();
      }


      showLocationInfo({ 
        terrainType, 
        simpleRisk,
        detailedRisk,
        nearestShelter: nearestName, 
        disasterHistory: "未設定", 
        title: "📍 クリック地点の情報" 
      });

      // お気に入り用
      const riskForFavorite = (detailedRisk && typeof detailedRisk.overall_risk === "number")
        ? detailedRisk
        : simpleRisk;
      

      // この地点情報でボタンを設定
      setFavoriteButton(lat, lng, terrainType, simpleRisk, detailedRisk, nearestName);

      

      
    
    } catch (err) {
      console.error("地形データ取得失敗:", err);
      if (currentLocationInfo) currentLocationInfo.textContent =
        "地形分類: データ取得に失敗しました";
    }
  });
}

// === モジュール初期化 ===
export async function initializeTerrainModule() {
  await loadRiskDatabase();
  setupMapClickEvent();
  initializeShelters();


  // 初期化時に現在地情報を取得
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      await updateCurrentLocationInfo(lat, lng);
    });
  }
}

window.getTerrainMode = getTerrainMode;
window.setTerrainMode = setTerrainMode;
