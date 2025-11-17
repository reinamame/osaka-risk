// 13terrain_detail_db.js

// 4risk.js にある canon とほぼ同じ（表記ゆらぎ吸収）:contentReference[oaicite:3]{index=3}
const canon = (s) => (s ?? "")
  .normalize("NFKC")
  .replace(/[（(].*?[)）]/g, "")
  .replace(/[ \u00A0\u3000・･•·．.\-]/g, "")
  .toLowerCase();

// CSV 1行をsplit（4risk.jsの splitCSV をほぼコピペ）:contentReference[oaicite:4]{index=4}
function splitCSV(line, sep = ",") {
  const re = sep === "\t" ? /\t/ : /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  return line.split(re).map(v => v.replace(/^"|"$/g, "").trim());
}

let terrainDetailDb = {};
let _loaded = false;

export async function loadTerrainDetailDB(csvPath = "/data/terrain_detail.csv") {
  if (_loaded) return terrainDetailDb;

  const res = await fetch(csvPath, { cache: "no-store" });
  if (!res.ok) {
    console.error("地形詳細CSV取得失敗:", res.status, csvPath);
    return terrainDetailDb;
  }

  const text = (await res.text()).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) return terrainDetailDb;

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

  const iName = idx(["terrain_name", "name", "地形名"]);
  const iSubtitle = idx(["subtitle", "サブタイトル"]);
  const iPoints = idx(["points", "ポイント"]);
  const iBousai = idx(["bousai", "防災"]);
  const iTourism = idx(["tourism", "観光"]);
  const iEdu = idx(["education", "教育"]);

  if (iName < 0) {
    console.error("terrain_detail.csv に terrain_name 列がありません");
    return terrainDetailDb;
  }

  terrainDetailDb = {};

  for (let r = 1; r < lines.length; r++) {
    const cols = splitCSV(lines[r], sep);
    const name = cols[iName];
    if (!name) continue;

    const subtitle = cols[iSubtitle] || "";
    const pointsRaw = cols[iPoints] || "";
    const bousaiRaw = cols[iBousai] || "";
    const tourismRaw = cols[iTourism] || "";
    const eduRaw = cols[iEdu] || "";

    const toList = (s) =>
      s.split("｜").map(t => t.trim()).filter(Boolean);

    terrainDetailDb[name] = {
      terrain_name: name,
      subtitle,
      points: toList(pointsRaw),
      bousai: toList(bousaiRaw),
      tourism: toList(tourismRaw),
      education: toList(eduRaw),
    };

    // 正規化キーでも引けるように
    terrainDetailDb[canon(name)] = terrainDetailDb[name];
  }

  _loaded = true;
  console.log("terrain_detail.csv 読み込み:", Object.keys(terrainDetailDb).length, "件");
  return terrainDetailDb;
}

export function getTerrainDetailByName(terrainName) {
  if (!terrainName) return null;
  return terrainDetailDb[terrainName] || terrainDetailDb[canon(terrainName)] || null;
}
