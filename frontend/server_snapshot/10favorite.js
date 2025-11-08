// 10favorite.js（DB連携・修正版）

import { map, L } from "./1map_layer.js";
import { showLocationInfo } from "./6infoUI.js";
import { findNearestShelter } from "./11nearestShelter/11nearestShelter.js"; // 避難所モジュール
import { assessDisasterRisk } from "./4risk.js?v=20251107b";
import { API_BASE, buildHeaders, getToken } from "./12auth.js";


// ★ 追加：マーカー一括消去用
let _favLayer = L.layerGroup();
export function clearFavoriteMarkers() {
  try { map.removeLayer(_favLayer); } catch(_) {}
  _favLayer.clearLayers();
}

// ===============================
// グローバル
// ===============================
let favoritePoints = [];   // DBから取得したお気に入り
let favoriteMarkers = [];  // 地図上のマーカー
let favoriteMarkerById = new Map();    // ID→マーカーの対応表
let favoritesVisible = false;

// ===============================
// API
// ===============================
const DEVICE_ID_KEY = "deviceId";
const deviceId = localStorage.getItem(DEVICE_ID_KEY) || crypto.randomUUID();
localStorage.setItem(DEVICE_ID_KEY, deviceId);


function authHeaders(json = true) {
  return json
    ? { "Content-Type": "application/json", "X-Device-ID": deviceId }
    : { "X-Device-ID": deviceId };
}

// 登録（POST）
async function saveFavoriteToDB(point) {
  const res = await fetch(`${API_BASE}/favorites`, {
    method: "POST",
    headers: buildHeaders({ auth: !!getToken(), json: true }),
    body: JSON.stringify(point),
  });
  return res.json();
}

// 一覧取得（GET）
async function loadFavoritesFromDB() {
  // 未ログインでは一覧取得を許可しない
  if (!getToken()) throw new Error("LOGIN_REQUIRED");
  const res = await fetch(`${API_BASE}/favorites`, {
    headers: buildHeaders({ auth: true, json: false })
  });
  if (!res.ok) throw new Error("/favorites 取得失敗");
  return res.json();
}

// 削除（DELETE）
async function deleteFavoriteFromDB(id) {
  const res = await fetch(`${API_BASE}/favorites/${id}`, {
    method: "DELETE",
    headers: buildHeaders({ auth: true, json: false })
  });
  return res.json();
}

// ===============================
// ポップアップ用HTML
// ===============================
function createPopupContent(point) {
  return `
    <strong>${point.title}</strong><br>
    <button class="removeFavoriteBtn">削除</button>
  `;
}

// ===============================
// 一覧ロード＆描画
// ===============================
async function loadFavorites() {
  // 既存マーカーをクリア
  clearFavoriteMarkers();
  favoritePoints = [];
  favoriteMarkerById.clear();

  let favorites = [];

  try {
    favorites = await loadFavoritesFromDB();   // ← 未ログインなら throw
  } catch (e) {
    // 未ログインやエラー時は何も表示しない
    return [];
  }

  favoritePoints = favorites;

  // favoriteMarkers.forEach(m => map.removeLayer(m));
  // favoriteMarkers = [];
  

  // const favorites = await loadFavoritesFromDB();
  

  for (const p of favorites) {
    // ★ DBのカラム名に合わせて lon を使う
    const marker = L.circleMarker([p.lat, p.lon], { color: "red", radius: 8 });
    favoriteMarkerById.set(p.id, marker);
    

    marker
      .bindPopup(createPopupContent(p))
      .on("popupopen", async (e) => {
        window.__infoSource = "favorite";
        const popupNode = e.popup.getElement();
        const btn = popupNode.querySelector(".removeFavoriteBtn");
        if (btn) {
          btn.onclick = async () => {
            await deleteFavoriteFromDB(p.id);
            map.closePopup();
            await loadFavorites(); // 再描画
            if (favoritesVisible) toggleFavoriteMarkers(true);
          };
        }

        // 情報カードの表示切替
        const currentLocationInfo = document.getElementById("currentLocationInfo");
        const infoCardMessage = document.getElementById("infoCardMessage");
        if (infoCardMessage) infoCardMessage.style.display = "none";
        if (currentLocationInfo) currentLocationInfo.style.display = "block";
  
        // 最寄り避難所（大阪府外なら null）
        const nearest = await findNearestShelter(p.lat, p.lon, false);
        const nearestName = nearest ? nearest.name : "情報なし";
  
        // DB → 表示用に整形
        const baseSimple =
          
          await assessDisasterRisk(p.lat, p.lon, p.terrain_type);
        const simpleRisk = {
          risk: p.risk_description || baseSimple?.risk || "不明",
          warnings: p.simple_warnings || baseSimple?.warnings || "基本的な防災対策を継続してください"
        };
        const detailedRisk = (typeof p.risk_score === "number")
          ? { 
              overall_risk: p.risk_score, 
              risk_description: p.risk_description, 
              explanation: p.explanation 
            }
          : null;
  
        showLocationInfo({
          terrainType: p.terrain_type || "不明",
          simpleRisk,
          detailedRisk,
          nearestShelter: nearestName,
          disasterHistory: "未設定",
          title: `⭐ ${p.title} の情報`
        });
      });

    _favLayer.addLayer(marker);
  };

  if (favoritesVisible) map.addLayer(_favLayer);
  console.log(`⭐ DBから ${favorites.length} 件のお気に入りを読み込みました`);
  return favorites;
}

// ===============================
// 追加（フロント → DB）
// ===============================
export async function addFavoritePoint({ lat, lng, title, terrainType, riskData }) {
  // 可能なら最寄り避難所も一緒に登録
  const nearest = await findNearestShelter(lat, lng, false);
  const nearestName = nearest ? nearest.name : "情報なし";

  const point = {
    lat,
    lon: lng, // ★ DBは lon
    title,
    terrain_type: terrainType,
    risk_score: riskData?.overall_risk ?? null,
    risk_description: riskData?.risk_description ?? null,
    explanation: riskData?.explanation ?? null,
    simple_warnings: riskData?.simple_warnings ?? null,
    nearest_shelter: nearestName,
  };

  const res = await saveFavoriteToDB(point);
  const newId = res?.id;
  alert("お気に入りをDBに登録しました！");

  // ログイン済みのときだけマーカー再描画（匿名時は地図に出さないポリシー）
  const loggedIn = !!getToken();
  if (loggedIn) {
    const zoom = map.getZoom();
    await loadFavorites();



    // フォーカスを登録地点へ固定（現在地に戻されない）
    const ll = L.latLng(lat, lng);
    map.setView(ll, zoom, { animate: false });
  
    // マーカーが可視状態ならポップアップを開く
    if (favoritesVisible && newId && favoriteMarkerById.has(newId)) {
      const m = favoriteMarkerById.get(newId);
      m.addTo(map);
      m.openPopup();
    }
  
  }

  window.__infoSource = "favorite";

  // マーカーを出していない場合も infoカードで “その地点の情報” を出す
  const detailedRisk =
    (riskData && typeof riskData.overall_risk === "number")
      ? { overall_risk: riskData.overall_risk, risk_description: riskData.risk_description, explanation: riskData.explanation }
      : null;
  const simpleRisk =
    !detailedRisk ? (riskData?.terrainRisk || { risk: "不明", warnings: "基本的な防災対策を継続してください" }) : null;


  showLocationInfo({
    terrainType,
    simpleRisk,
    detailedRisk,
    nearestShelter: nearestName,
    disasterHistory: "未設定",
    title: `⭐ ${title} の情報`
  });

}

// ===============================
// 削除（座標指定で）
// ===============================
export async function removeFavoritePoint(lat, lon) {
  const match = favoritePoints.find(p => p.lat === lat && p.lon === lon);
  if (!match) return alert("該当データが見つかりません");

  await deleteFavoriteFromDB(match.id);
  alert("お気に入りを削除しました！");
  await loadFavorites();
}

// ===============================
// 「お気に入りに追加」ボタンにハンドラ付与
// ===============================
export function setFavoriteButton(lat, lng, terrainType, simpleRisk, detailedRisk) {
  const btn = document.getElementById("favoriteBtn");
  if (!btn) return;

  btn.onclick = null;
  btn.onclick = async () => {
    const title = prompt("お気に入り名称を入力してください", "お気に入り地点");
    if (!title) return;

    const nearest = await findNearestShelter(lat, lng, false);
    const nearestName = nearest ? nearest.name : "情報なし";

    const riskForFavorite = {
      overall_risk: detailedRisk?.overall_risk ?? null,
      risk_description: detailedRisk?.risk_description ?? simpleRisk?.risk ?? null,
      explanation: detailedRisk?.explanation ?? null,
      simple_warnings: simpleRisk?.warnings ?? null,
      nearest_shelter: nearestName,
    };

    await addFavoritePoint({
      lat,
      lng,
      title,
      terrainType,
      riskData: riskForFavorite,
    });
  };
}

// ===============================
// お気に入りリスト表示ボタン
// ===============================
export function showFavoriteListButton() {
  const btn = document.getElementById("showFavoriteListBtn");
  if (!btn) return;

  btn.style.display = "inline-block";
  btn.onclick = () => {
    // 未ログインなら開かない
    if (!getToken()) { alert("一覧を表示するにはログインしてください"); return; }
    const container = document.getElementById("favoriteListContainer");
    const isHidden = container.style.display === "none" || container.style.display === "";

    container.style.display = isHidden ? "block" : "none";
    btn.textContent = isHidden ? "📋 お気に入りリスト非表示" : "📋 お気に入りリスト表示";

    if (isHidden) renderFavoriteList();
  };

  btn.textContent = "📋 お気に入りリスト表示";
}

// ===============================
// リスト描画（最新データで）
// ===============================
async function renderFavoriteList() {
  const listEl = document.getElementById("favoriteList");
  if (!listEl) return;
  if (!getToken()) { alert("一覧を表示するにはログインしてください"); return; }

  const favorites = await loadFavoritesFromDB(); // 最新取得
  // HTMLを一括生成（番号つき）
  listEl.innerHTML = favorites.map((p, idx) => `
    <div class="favorite-item"
         data-id="${p.id}"
         style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #eee;">
      <button class="fav-index"
              data-id="${p.id}"
              title="この地点を表示"
              style="width:26px;height:26px;border-radius:50%;border:1px solid #888;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">
        ${idx + 1}
      </button>
      <span class="fav-title"
            data-id="${p.id}"
            style="flex:1;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${p.title ?? `${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`}
      </span>
      <button class="fav-del"
              data-id="${p.id}"
              title="削除"
              style="padding:2px 8px;">削除</button>
    </div>
  `).join("");

  // 1) 表示（番号 or タイトル クリック）
  const openById = async (id) => {
    const p = favorites.find(x => String(x.id) === String(id));
    if (!p) return;
    map.setView([p.lat, p.lon], 16);

    // infoCardの表示切替
    const currentLocationInfo = document.getElementById("currentLocationInfo");
    const infoCardMessage    = document.getElementById("infoCardMessage");
    if (infoCardMessage) infoCardMessage.style.display = "none";
    if (currentLocationInfo) currentLocationInfo.style.display = "block";

    // 近傍避難所
    const nearest = await findNearestShelter(p.lat, p.lon, false);
    const nearestName = nearest ? nearest.name : "情報なし";

    // 表示用リスク（DB値を優先し、無ければ地形ベース）
    const baseSimple =
      
      await assessDisasterRisk(p.lat, p.lon, p.terrain_type);
    const simpleRisk = {
      risk: p.risk_description || baseSimple?.risk || "不明",
      warnings: p.simple_warnings || baseSimple?.warnings || "基本的な防災対策を継続してください"
    };
    const detailedRisk = (typeof p.risk_score === "number")
      ? { overall_risk: p.risk_score, risk_description: p.risk_description, explanation: p.explanation }
      : null;

    showLocationInfo({
      terrainType: p.terrain_type || "不明",
      simpleRisk,
      detailedRisk,
      nearestShelter: nearestName,
      disasterHistory: "未設定",
      title: `⭐ ${p.title || "お気に入り地点"} の情報`
    });
  };
  listEl.querySelectorAll(".fav-index, .fav-title").forEach(el => {
    el.addEventListener("click", () => openById(el.dataset.id));
  });

  // 2) 削除
  listEl.querySelectorAll(".fav-del").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteFavoriteFromDB(btn.dataset.id);
      await renderFavoriteList(); // 再描画
    });
  });
}

// ===============================
// マーカー表示切替
// ===============================
export function toggleFavoriteMarkers(show = true) {
  // 未ログインなら強制非表示・消去
  if (!getToken()) {
    favoritesVisible = false;
    try { map.removeLayer(_favLayer); } catch (_) {}
    return;
  }
  favoritesVisible = !!show;
  if (favoritesVisible) {
    map.addLayer(_favLayer);
  } else {
    try { map.removeLayer(_favLayer); } catch (_) {}
  }
}


// ===============================
// 初期化
// ===============================
export async function initializeFavorites() {
  // 未ログインなら何も出さない（匿名お気に入りは地図に表示しない方針）
  if (!getToken()) {
    clearFavoriteMarkers();
    return;
  }
  await loadFavorites();            // ログイン時のみ取得
  if (favoritesVisible) map.addLayer(_favLayer);
}
