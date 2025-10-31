// 4risk.js
let riskDatabase = {};

export async function loadRiskDatabase(csvPath = "/data/geodata.csv") {
  try {
    const res = await fetch(csvPath, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV取得失敗: ${res.status} ${csvPath}`);

    // BOM除去 + 改行
    const text = (await res.text()).replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    if (!lines.length) { console.warn("CSVが空"); return false; }

    // 区切り子を自動判別（タブ優先、なければカンマ）
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ""));

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

    for (let r = 1; r < lines.length; r++) {
      const cols = lines[r].split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
      const name = cols[iName] || "";
      if (!name) continue;

      const evaluation = cols[iEval] || "不明";                 // 高/中/低 など
      const desc       = (cols[iDesc] || "基本的な防災対策を継続してください");
      const label      = cols[iLabel] || "災害リスク";

      let color = "#27ae60";               // 低
      if (evaluation === "高") color = "#e74c3c";
      else if (evaluation === "中") color = "#f39c12";

      riskDatabase[name] = {
        // 既存UI互換
        risk: `<span style="color:${color};">${label}: ${evaluation}</span>`,
        warnings: desc,
        // infocardが読むキー（簡易リスク）
        simplerisk_risk: evaluation,
        simplerisk_warnings: desc,
      };
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
