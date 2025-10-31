// main.js
import { map, baseMap } from "./1map_layer.js";
import { initializeLegend } from "./8legend/8legend.js";

import { setupLocationFeatures } from "./3location.js";

import { getTerrainFromAPI } from "./2terrain.js";
import { assessDisasterRisk, fetchRiskFromAPI, loadRiskDatabase } from "./4risk.js?v=2";

import { setupTerrainToggle } from "./9terrain_btn.js";

import { updateCurrentLocationInfo, initializeTerrainModule } from "./7current_UI.js";
import { initializeFavorites, addFavoritePoint, toggleFavoriteMarkers, showFavoriteListButton, setFavoriteButton } from "./10favorite.js";
import { findNearestShelter } from "./11nearestShelter/11nearestShelter.js";
import {
  register, login, logout, claimDevice, me,
  API_BASE, getToken
} from "./12auth.js";

let lastLat = null;
let lastLng = null;
let lastTerrainType = null;
let lastSimpleRisk = null;
let lastDetailedRisk = null;



document.addEventListener("DOMContentLoaded", async () => {
  // 1. 地図の初期化
  baseMap.addTo(map);          // 1map_layer.js

  // 凡例ボタン追加
  initializeLegend(map);              // 8legend.js

  // お気に入り復元
  initializeFavorites();   // 10favorite.js
  // await initializeShelters();   // 避難所モジュールを初期化

  // 現在地優先を既定に（お気に入りを開いたら後で favorite に切り替える）
  window.__infoSource = "current";

// 表示状態を保持するフラグ
  let favoritesVisible = false;
  
  await updateLoginUI();       

  await loadRiskDatabase("/data/geodata.csv?v=20251030a");



  // 3. 現在地取得と情報表示
  setupLocationFeatures(map, async (lat, lng) => {
    lastLat = lat;
    lastLng = lng;

    if (window.__infoSource !== "current") return;

    


    const terrainType = await getTerrainFromAPI(lat, lng);
    lastTerrainType = terrainType;

    // 詳細リスク取得
    let detailedRisk = await fetchRiskFromAPI(lat, lng);
    let simpleRisk = null;
    
    // ✅ 「status」が ok のときのみ詳細リスクを使う
    if (detailedRisk && detailedRisk.status === "ok") {
      lastDetailedRisk = {
        overall_risk: detailedRisk.overall_risk,
        risk_description: detailedRisk.risk_description,  // ← 追加
        explanation: detailedRisk.explanation,             // ← 追加
        warnings: detailedRisk.risk_description,
        flood: detailedRisk.flood,
        landslide: detailedRisk.landslide,
        tsunami: detailedRisk.tsunami
      };
      lastSimpleRisk = null;
    } else {
      // ✅ 詳細データがない場合 → 簡易リスクで代用
      lastSimpleRisk = await assessDisasterRisk(lat, lng, terrainType);
      lastDetailedRisk = null;
    }


    // 📍 クリックした地点から最寄り避難所を探す
    const nearest = await findNearestShelter(lat, lng, true);
    if (nearest) {
      const { shelter, distance } = nearest;
      console.log("Nearest Shelter:", shelter.properties, distance.toFixed(0) + "m");
      // TODO: showShelterInfo(shelter.properties, distance);
    }
    updateCurrentLocationInfo(
      lat, lng, terrainType,
      lastDetailedRisk || lastSimpleRisk,
      nearest
    );
    setFavoriteButton(lat, lng, terrainType, lastSimpleRisk, lastDetailedRisk);
  });

  console.log(document.getElementById("infoCardMessage"));
  console.log(document.getElementById("currentLocationInfo"));


  // 4. 任意地点判定ボタン
  setupTerrainToggle("terrainToggle", "infoCard");        // 9terrain_btn.js

  await initializeTerrainModule();
  // await initializeShelters();   // 避難所モジュールを初期化


  document.getElementById("favoriteBtn").onclick = () => {
      if (lastLat === null || lastLng === null) {
        alert("現在地が取得できていません");
        return;
      }
        
      // ユーザーに名称を入力してもらう
      const title = prompt("この地点のお気に入り名称を入力してください", "お気に入り地点");
      if (!title) return;  // キャンセルした場合は何もしない
  
      // リスク情報を選択：詳細リスクがあればそれを優先
      const riskToSave = lastDetailedRisk || lastSimpleRisk;
  
  
      addFavoritePoint({
        lat: lastLat,
        lng: lastLng,
        title,
        terrainType: lastTerrainType,
        riskData: riskToSave
      });
    }


  

  const showListBtn = document.getElementById("showFavoriteListBtn");
  
  document.getElementById("showFavoritesBtn").onclick = () => {
    // 未ログインなら表示させない
    if (!getToken()) {
      alert("お気に入りを表示するにはログインしてください");
      favoritesVisible = false;
      toggleFavoriteMarkers(false);
      showListBtn.style.display = "none";
      const listContainer = document.getElementById("favoriteListContainer");
      if (listContainer) listContainer.style.display = "none";
      document.getElementById("showFavoritesBtn").textContent = "⭐ お気に入り表示";
      return;
    }

    favoritesVisible = !favoritesVisible;
    toggleFavoriteMarkers(favoritesVisible);
  
    if (favoritesVisible) {
      showFavoriteListButton();                  // 既存
      document.getElementById("showFavoriteListBtn").style.display = "inline-block"; // ⭐ON時にだけ出す
    } else {
      showListBtn.style.display = "none";
      const listContainer = document.getElementById("favoriteListContainer");
      if (listContainer) listContainer.style.display = "none";
    }
    document.getElementById("showFavoritesBtn").textContent =
      favoritesVisible ? "⭐ お気に入り非表示" : "⭐ お気に入り表示";
    
    updateLoginUI();
  };




  document.getElementById("btnLogin")?.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const pass  = document.getElementById("loginPass").value;
    await login(email, pass);
    await claimDevice();
    await initializeFavorites();
    await updateLoginUI();     // ★ 追加
    alert("ログインしました");
  });
  
  document.getElementById("btnRegister")?.addEventListener("click", async () => {
    const email = document.getElementById("regEmail").value.trim();
    const pass  = document.getElementById("regPass").value;
    const nick  = document.getElementById("regNickname").value.trim();
    await register(email, pass, nick);
    await claimDevice();
    await initializeFavorites();
    await updateLoginUI();   // ★ 追加
    alert("登録＆ログインしました");
  });

  
  document.getElementById("btnLogout")?.addEventListener("click", () => {
    logout();
    updateLoginUI();    
    alert("ログアウトしました");
  });


  // --- 追加: ステータス用DOMを用意 ---
  function ensureLoginStatusEl() {
    const box = document.getElementById("authBox");
    if (!box) return null;
    let el = document.getElementById("loginStatus");
    if (!el) {
      el = document.createElement("div");
      el.id = "loginStatus";
      el.style.margin = "6px 0";
      el.style.fontSize = "12px";
      el.style.color = "#666";
      box.insertBefore(el, box.firstChild); // 枠の一番上に表示（レイアウトは変えない）
    }
    return el;
  }
  
  // --- 追加: ログイン状態の表示/切替 ---
  async function updateLoginUI() {
    const el = ensureLoginStatusEl();
    if (!el) return;
    const has = !!getToken();
  
    // ボタン・入力欄の有効/無効
    const loginBtn = document.getElementById("btnLogin");
    const regBtn   = document.getElementById("btnRegister");
    const logoutBtn= document.getElementById("btnLogout");
    [loginBtn, regBtn].forEach(b => b && (b.disabled = has));
    if (logoutBtn) logoutBtn.disabled = !has;
  
    ["loginEmail","loginPass","regEmail","regPass","regNickname"]
      .map(id => document.getElementById(id))
      .forEach(inp => inp && (inp.disabled = has));
  
    if (has) {
      try {
        const u = await me();             // /me でメール表示
        el.textContent = `✅ ログイン中：${u.email}`;
        el.style.color = "#0a0";
      } catch {
        el.textContent = "⚠️ トークンが無効です。再ログインしてください";
        el.style.color = "#a00";
      }
    } else {
      el.textContent = "🚪 未ログイン";
      el.style.color = "#666";
    }

    // ログイン状態に合わせてリストボタン/枠を出し分け
    const listBtn = document.getElementById("showFavoriteListBtn");
    const listBox = document.getElementById("favoriteListContainer");
    if (listBtn) listBtn.style.display = (has && favoritesVisible) ? "inline-block" : "none";
    if (!has || !favoritesVisible) { if (listBox) listBox.style.display = "none"; }
  }
  

});

// ← 未ログイン時は一覧を出さない版
async function refreshFavoriteList() {
  const box  = document.getElementById("favoriteListContainer");
  const list = document.getElementById("favoriteList");

  const token = getToken();
  if (!token) {
    alert("一覧を表示するにはログインしてください");
    return;
  }
  const headers = { Authorization: "Bearer " + token };

  const res  = await fetch(`${API_BASE}/favorites`, { headers });
  const favs = await res.json();

  box.style.display = "block";

  // 削除
  list.querySelectorAll("button[data-del]").forEach(btn => {
    btn.onclick = async () => {
      await fetch(`${API_BASE}/favorites/${btn.dataset.del}`, {    // ← 直書きURLを廃止
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      btn.closest(".fav-row")?.remove();
    };
  });
}

