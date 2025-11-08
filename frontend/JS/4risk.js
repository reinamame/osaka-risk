// 4risk.js
let riskDatabase = {};

export function isRiskDbReady() { return Object.keys(riskDatabase).length > 0; }
export async function ensureRiskDb(csv="/data/geodata.csv?v=20251107") {
  if (isRiskDbReady()) return true;
  if (!_riskDbReady) _riskDbReady = loadRiskDatabase(csv);
  return _riskDbReady;
}
// 表記ゆらぎを吸収：NFKC正規化→括弧内削除→空白/中黒/記号除去→小文字化
const canon = (s) => (s ?? "")
  .normalize("NFKC")
  .replace(/[（(].*?[)）]/g, "")
  .replace(/[ \u00A0\u3000・･•·．.\-]/g, "")
  .toLowerCase();
// CSV 1行を「クォート内のカンマを壊さずに」splitする簡易版
function splitCSV(line, sep=",") {
  const re = sep === "\t" ? /\t/ : /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  return line.split(re).map(v => v.replace(/^"|"$/g,"").trim());
}

export async function loadRiskDatabase(csvPath = "/data/geodata.csv") {
  console.log('[4risk] loadRiskDatabase called at', import.meta.url, 'csv=', csvPath);

  try {
    const res = await fetch(csvPath, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV取得失敗: ${res.status} ${csvPath}`);

    // BOM除去 + 改行
    const text = (await res.text()).replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    if (!lines.length) { console.warn("CSVが空"); return false; }

    // 区切り子を自動判別（タブ優先、なければカンマ）
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = splitCSV(lines[0], sep);

    const idx = (names) => {
      const norm = s => s.toLowerCase().replace(/\s+/g, "");
      const H = headers.map(norm);
      for (const n of names) {
        const i = H.indexOf(norm(n));
        if (i >= 0) return i;
      }
      return -1;
    };

    const iName = idx(["name","terrain","terrain_name","地形","地形名","名称"]);
    const iEval = idx(["evaluation","risklevel","評価","レベル"]);
    const iDesc = idx(["description","desc","note","説明","備考","コメント"]);
    const iLabel= idx(["risk","risk_label","危険度ラベル","ラベル"]);

    if (iName < 0) { console.error("CSVに name/地形名 列が見つからない"); return false; }

    // for (let r = 1; r < lines.length; r++) {
      // const cols = lines[r].split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    riskDatabase = {};
    for (let r = 1; r < lines.length; r++) {
      const cols = splitCSV(lines[r], sep);
      const name = cols[iName] || "";
      if (!name) continue;

      const evaluation = cols[iEval] || "不明";                 // 高/中/低 など
      const desc       = (cols[iDesc] || "基本的な防災対策を継続してください");
      const label      = cols[iLabel] || "災害リスク";

      let color = "#27ae60";               // 低
      if (evaluation === "高") color = "#e74c3c";
      else if (evaluation === "中") color = "#f39c12";

      const rec = {
        // 既存UI互換
        risk: `<span style="color:${color};">${label}: ${evaluation}</span>`,
        warnings: desc,
        // infocardが読むキー（簡易リスク）
        simplerisk_risk: evaluation,
        simplerisk_warnings: desc,
      };
      // 元の表記でも、正規化キーでも、両方で引けるように登録
      riskDatabase[name] = rec;
      riskDatabase[canon(name)] = rec;
    }

    console.log("リスクDB読み込み:", Object.keys(riskDatabase).length, "件");
    return true;
  } catch (e) {
    console.error("CSV読み込み失敗:", e);
    return false;
  }
}

// フォールバック（簡易リスク）も UI互換キーを返す
export async function assessDisasterRisk(lat, lng, terrainType) {
  const msg = "基本的な防災対策を継続してください";
  return {
    risk: "不明",
    warnings: msg,
    simplerisk_risk: "不明",
    simplerisk_warnings: msg,
  };
}

// ---- ensure named exports for other modules ----
export async function fetchRiskFromAPI(lat, lon) {
  try {
    const base = (typeof window !== "undefined" && window.__API_BASE) ? window.__API_BASE : "";
    const url = `${base}/risk?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    if (!res.ok) {
      return { status: "error", http_status: res.status };
    }
    return await res.json(); // { status, overall_risk, risk_description, explanation, ... }
  } catch (e) {
    console.warn("fetchRiskFromAPI failed:", e);
    return { status: "error", error: String(e) };
  }
}
// 
// 既存のローカル評価関数がある前提（無ければ仮でデータ返す実装を置く）
// 地形名から CSV で読んだ説明を返す（ヒットしなければ null）
// export async function getDetailedRiskByTerrain(terrainName) {
  // if (!terrainName) return null;
  // ① 完全一致（元の表記／正規化キー）
  // let r = riskDatabase[terrainName] || riskDatabase[canon(terrainName)];
  // ② ダメなら部分一致（正規化キー同士で includes）
  // if (!r) {
    // const q = canon(terrainName);
    // let best = null, bestScore = 0;
    // for (const k of Object.keys(riskDatabase)) {
      // const ck = canon(k);
      // if (!ck) continue;
      // const score = (ck.includes(q) || q.includes(ck)) ? Math.min(ck.length, q.length) : 0;
      // if (score > bestScore) { bestScore = score; best = riskDatabase[k]; }
    // }
    // if (bestScore >= 2) r = best;
  // }
  // if (!r) return null;
  // return {
    // risk: r.simplerisk_risk ?? r.risk ?? "不明",
    // warnings: r.simplerisk_warnings ?? r.warnings ?? "基本的な防災対策を継続してください",
  // };
// }

export function getDetailedRiskByTerrain(terrainType) {
  // 地形名での完全一致を確認
  if (riskDatabase[terrainType]) {
    return riskDatabase[terrainType]
  }

  // 部分一致での検索
  for (const [key, value] of Object.entries(riskDatabase)) {
    if (terrainType.includes(key) || key.includes(terrainType)) {
      return value
    }
  }

  // マッチしない場合はnullを返す（フォールバック処理へ）
  return null
}
