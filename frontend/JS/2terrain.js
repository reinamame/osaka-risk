// =====  地形判別機能 =====


// --- 静かなフェッチ（404/非JSONは黙って無視） ---
window.__DEBUG ??= false; // 必要なとき DevTools から true に

async function fetchGeoJSONSafe(url, label){
  try{
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) { if (window.__DEBUG) console.debug(label, "404:", url); return null; }
    if (!res.ok)           { if (window.__DEBUG) console.warn (label, res.status, url); return null; }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) { if (window.__DEBUG) console.warn(label, "non-JSON:", ct, url); return null; }
    return await res.json();
  }catch(e){
    if (window.__DEBUG) console.error(label, "fetch error:", e);
    return null;
  }
}


// 座標から地形分類を取得するメイン関数
export async function getTerrainFromAPI(lat, lng) {
  try {
    if (window.__DEBUG) console.log(`地形判別開始: 座標 ${lat}, ${lng}`);

    const zoom = 14;
    const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const tileY = Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
    );
    if (window.__DEBUG) console.log(`タイル座標: ${zoom}/${tileX}/${tileY}`);

    const urls = [
      { url: `https://cyberjapandata.gsi.go.jp/xyz/experimental_landformclassification1/${zoom}/${tileX}/${tileY}.geojson`, type: "natural"     },
      { url: `https://cyberjapandata.gsi.go.jp/xyz/experimental_landformclassification2/${zoom}/${tileX}/${tileY}.geojson`, type: "artificial"  },
    ];

    let bestMatch = null;
    let minDistance = Number.POSITIVE_INFINITY;

    for (const { url, type } of urls) {
      const data = await fetchGeoJSONSafe(url, type);
      if (!data?.features?.length) continue;

      for (const feature of data.features) {
        if (window.__DEBUG) { console.debug(`フィーチャー (${type})`, feature.properties); }

        if (!(feature.geometry && feature.geometry.coordinates)) continue;

        let isInside = false;
        let featureLat, featureLng;

        if (feature.geometry.type === "Point") {
          [featureLng, featureLat] = feature.geometry.coordinates;
          const distance = Math.hypot(lat - featureLat, lng - featureLng);
          if (distance < 0.001) isInside = true; // 約100m以内
        } else if (feature.geometry.type === "Polygon") {
          const ring = feature.geometry.coordinates[0];
          isInside = isPointInPolygon([lng, lat], ring);
          // 重心（ざっくり）
          featureLng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
          featureLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        } else if (feature.geometry.type === "MultiPolygon") {
          for (const polygon of feature.geometry.coordinates) {
            if (isPointInPolygon([lng, lat], polygon[0])) { isInside = true; break; }
          }
          const first = feature.geometry.coordinates?.[0]?.[0];
          if (first?.length) {
            featureLng = first.reduce((s, c) => s + c[0], 0) / first.length;
            featureLat = first.reduce((s, c) => s + c[1], 0) / first.length;
          }
        }

        if (isInside || (featureLat && featureLng)) {
          const distance = (featureLat && featureLng) ? Math.hypot(lat - featureLat, lng - featureLng) : 0;
          if (isInside || distance < minDistance) {
            minDistance = distance;
            bestMatch = { feature, type };
            if (window.__DEBUG) console.debug(`マッチ更新 (${type})`, feature.properties);
          }
        }
      }
    }

    if (bestMatch?.feature?.properties) {
      const props = bestMatch.feature.properties;
      if (window.__DEBUG) console.log("全プロパティ:", props);

      const code =
        props.LandformClassification ||
        props.landform_classification ||
        props.code || props.type || props.class || props.classification ||
        props.landform || props.地形分類 || props.分類コード || props.CODE || props.TYPE || props.CLASS;

      if (window.__DEBUG) console.log("取得したコード:", code, "データタイプ:", bestMatch.type);

      if (code) {
        const terrainName = getLandformName(code);
        if (window.__DEBUG) console.log("変換後の地形名:", terrainName);
        return terrainName;
      } else {
        if (window.__DEBUG) console.log("地形分類コード見つからず:", Object.keys(props));
        return `地形データあり（${bestMatch.type === "natural" ? "自然地形" : "人工地形"}）`;
      }
    } else {
      if (window.__DEBUG) console.log("該当する地形分類が見つかりませんでした");
      return "地形分類データなし";
    }
  } catch (error) {
    console.error("地形取得エラー:", error);
    return "データ取得エラー";
  }
}


// ポリゴン内判定関数(点がポリゴン内にあるかどうか）
function isPointInPolygon(point, polygon) { // pointは判定したい点の座標
  // 初期化
  const x = point[0],
    y = point[1]
  let inside = false

//   レイキャスティング法
// 「点から右向きに水平な光線を引いて、ポリゴンの辺と交差する回数が奇数なら中、偶数なら外」
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1]
    const xj = polygon[j][0],
      yj = polygon[j][1]

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

export function getLandformName(code) {
  const landformTypes = {
    // === ベクトルタイル「地形分類」 ===

    // 山地・丘陵地
    10101: "山地斜面",
    11201: "火砕丘",
    11202: "溶岩円頂丘",
    11203: "火口",
    11204: "溶岩流地形",
    1010101: "山地",

    // 崖・段丘崖
    10202: "崖/壁岩",
    10204: "禿しゃ地・露岩",
    2010201: "崖（段丘崖）",

    // 地すべり地形
    10205: "地すべり（滑落崖）／地すべり（崩壊部）",
    10206: "地すべり（移動体）／地すべり（堆積部）",

    // 台地・段丘
    10301: "高位面",
    10302: "上位面",
    10303: "中位面",
    10304: "下位面",
    10305: "完新世段丘／低位面",
    10306: "台地･段丘",
    10307: "対比困難な段丘",
    10308: "洪積台地",
    10310: "岩石台地",
    10312: "溶岩台地",
    10314: "更新世段丘",
    10508: "台地･段丘状の地形",
    2010101: "段丘面",

    // 山麓堆積地形
    10401: "麓屑面",
    10402: "崖錐",
    10403: "土石流堆",
    10404: "土石流段丘",
    10406: "山麓堆積地形",
    10407: "崖錐・麓屑面・土石流堆",
    3010101: "山麓堆積地形",

    // 扇状地
    10501: "扇状地",
    10502: "緩扇状地",
    3020101: "扇状地",

    // 自然堤防
    10503: "自然堤防",
    3040101: "微高地（自然堤防）",

    // 天井川等
    10506: "天井川・天井川沿いの微高地／天井川沿微高地",
    10507: "旧天井川の微高地",
    10801: "天井川の部分",

    // 砂州・砂丘
    10504: "砂丘",
    10505: "砂（礫）堆・州",
    10512: "砂州・砂堆・砂丘",
    3050101: "砂州・砂丘",

    // 凹地・浅い谷
    10601: "凹地・浅い谷",
    2010301: "浅い谷",

    // 氾濫平野・海岸平野
    10701: "谷底平野・氾濫平野",
    10702: "海岸平野・三角州",
    10705: "湖岸平野・三角州",
    3030101: "氾濫平野",

    // 後背低地・湿地
    10703: "後背低地",
    10804: "湿地／湿地・水草地",
    3030201: "後背湿地",

    // 旧河道
    10704: "旧河道",
    3040201: "旧河道（明瞭）",
    3040202: "旧河道（不明瞭）",
    3040301: "落堀",

    // 河川敷・浜
    10802: "高水敷",
    10803: "低水敷・浜",
    10807: "低水敷・浜・潮汐平野",
    10808: "高水敷・低水敷・浜",

    // 水部
    10805: "落堀",
    10806: "潮汐平野",
    10901: "水部",
    10903: "河川・水涯線及び水面",
    5010201: "現河道・水面",

    // 旧水部
    10904: "旧水部",
    5010301: "旧水部",

    // 	切土地
    11001: "切土地／平坦化地",
    11003: "切土斜面",
    11009: "凹陥地",
    11011: "切土地",
    4010301: "切土地",

    11002: "農耕平坦化地",

    11008: "干拓地",
    4010101: "干拓地",

    11004: "盛土斜面",
    11005: "高い盛土地",
    11006: "盛土地",
    11007: "埋土地",
    11014: "盛土地・埋立地",
    4010201: "盛土地・埋立地",

    11010: "改変工事中",
  }

  // コードを文字列に変換して、前後の空白を削除
  const codeStr = String(code).trim()
  // デバッグ用にどのコードが渡されたか表示
  console.log(`地形分類コード変換: ${codeStr}`)

  // 完全一致を最優先
  if (landformTypes[codeStr]) {
    console.log(`完全一致: ${landformTypes[codeStr]}`)
    return landformTypes[codeStr]
  }

  // 特殊なケース：数値以外の文字列が含まれる場合
  if (isNaN(Number.parseInt(codeStr))) {
    return `地形分類（${codeStr}）`
  }

  // どの分類にも該当しない場合
  console.log(`未知の地形分類コード: ${codeStr}`)
  return `未分類地形（コード: ${codeStr}）`
}

// ===== window に登録してコンソールで直接呼べるようにする =====
window.getTerrainFromAPI = getTerrainFromAPI;