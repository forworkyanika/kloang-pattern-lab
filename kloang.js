/* Kloang Pattern Lab — poem-level first-occurrence encoding (Method 4+)
 * พอร์ตจาก method4_poem_level.py ให้ผลตรงกันทุกฟังก์ชัน
 * โครงสร้างกลอน: poem = [ บาท = [ วรรค = [พยางค์, ...], ... ], ... ]
 */
(function (root) {
  "use strict";

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const WAK_NAMES = ["วรรคหน้า", "วรรคหลัง", "คำสร้อย"];

  // ---------- parsing ----------
  /** แปลงข้อความเป็นกลอน: 1 บรรทัด = 1 บาท, "|" คั่นวรรค, ช่องว่างคั่นพยางค์
   *  ไม้ยมก "ๆ" (แยกหรือติดท้ายคำ) ถูกขยายเป็นหน่วยก่อนหน้าในบาทเดียวกัน */
  function parsePoem(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        let prev = null;
        return line
          .split("|")
          .map((wak) => {
            const out = [];
            for (let tok of wak.trim().split(/\s+/).filter(Boolean)) {
              let reps = 0;
              while (tok.length > 1 && tok.endsWith("ๆ")) { tok = tok.slice(0, -1); reps++; }
              if (tok === "ๆ") { if (prev !== null) out.push(prev); continue; }
              out.push(tok); prev = tok;
              for (let i = 0; i < reps; i++) out.push(tok);
            }
            return out;
          })
          .filter((wak) => wak.length > 0);
      })
      .filter((bat) => bat.length > 0);
  }

  function poemToText(poem) {
    return poem.map((bat) => bat.map((wak) => wak.join(" ")).join(" | ")).join("\n");
  }

  // ---------- positions ----------
  const posKey = (p) => `${p.bat}.${p.wak}.${p.k}`;
  const posLabel = (p) => `บ${p.bat}.ว${p.wak}.${p.k}`;
  const parseKey = (key) => {
    const [bat, wak, k] = key.split(".").map(Number);
    return { bat, wak, k };
  };

  /** [{pos, token, index}] ตามลำดับการอ่าน (บาทเริ่ม 1, วรรคเริ่ม 0, k เริ่ม 0) */
  function flattenWithPos(poem) {
    const out = [];
    poem.forEach((bat, b) =>
      bat.forEach((wak, w) =>
        wak.forEach((token, k) =>
          out.push({ pos: { bat: b + 1, wak: w, k }, token, index: out.length })
        )
      )
    );
    return out;
  }

  /** ทุก token → ตำแหน่งแรกที่คำเดียวกันปรากฏในทั้งบท */
  function poemFirstOccurrence(poem) {
    const first = new Map();
    return flattenWithPos(poem).map((t) => {
      if (!first.has(t.token)) first.set(t.token, t.pos);
      return { ...t, src: first.get(t.token) };
    });
  }

  /** ลายตัวอักษร (canonical form / restricted growth string) แยกตามบาท */
  function letterPattern(poem) {
    const labels = new Map();
    const label = (t) => {
      if (!labels.has(t)) labels.set(t, LETTERS[labels.size] || `#${labels.size}`);
      return labels.get(t);
    };
    return poem.map((bat) => bat.map((wak) => wak.map(label).join(" ")).join(" | "));
  }

  /** NEW / SAME (ซ้ำในบาทเดียวกัน) / CROSS (ซ้ำกับบาทก่อนหน้า) */
  function backReferences(poem) {
    return poemFirstOccurrence(poem).map((t) => {
      const isNew = posKey(t.src) === posKey(t.pos);
      const kind = isNew ? "NEW" : t.src.bat === t.pos.bat ? "SAME" : "CROSS";
      return { ...t, kind };
    });
  }

  // ---------- rules ----------
  /** กฎ = คู่ตำแหน่ง (src, pos) ที่ต้องเป็นคำเดียวกัน (เหมือน extract_rules ใน Python) */
  function extractRules(poem) {
    return backReferences(poem)
      .filter((t) => t.kind !== "NEW")
      .map((t) => ({ a: t.src, b: t.pos, kind: t.kind }));
  }

  /** ทุกคู่ตำแหน่งที่เป็นคำเดียวกัน (ใช้หา intersection ระหว่างหลายบท) */
  function equalPairs(poem) {
    const flat = flattenWithPos(poem);
    const pairs = new Set();
    for (let i = 0; i < flat.length; i++)
      for (let j = i + 1; j < flat.length; j++)
        if (flat[i].token === flat[j].token) pairs.add(`${posKey(flat[i].pos)}|${posKey(flat[j].pos)}`);
    return pairs;
  }

  /** ย่อชุดคู่ที่เท่ากันให้เหลือรูป first-occurrence (union-find) */
  function pairsToRules(pairs) {
    const parent = new Map();
    const find = (x) => {
      if (!parent.has(x)) parent.set(x, x);
      while (parent.get(x) !== x) {
        parent.set(x, parent.get(parent.get(x)));
        x = parent.get(x);
      }
      return x;
    };
    const cmp = (x, y) => {
      const a = parseKey(x), b = parseKey(y);
      return a.bat - b.bat || a.wak - b.wak || a.k - b.k;
    };
    for (const pr of pairs) {
      const [x, y] = pr.split("|");
      const rx = find(x), ry = find(y);
      if (rx !== ry) parent.set(cmp(rx, ry) <= 0 ? ry : rx, cmp(rx, ry) <= 0 ? rx : ry);
    }
    const groups = new Map();
    for (const x of parent.keys()) {
      const r = find(x);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(x);
    }
    const rules = [];
    for (const members of groups.values()) {
      members.sort(cmp);
      const head = parseKey(members[0]);
      for (const m of members.slice(1)) {
        const b = parseKey(m);
        rules.push({ a: head, b, kind: head.bat === b.bat ? "SAME" : "CROSS" });
      }
    }
    rules.sort((r1, r2) => cmp(posKey(r1.b), posKey(r2.b)));
    return rules;
  }

  /** กฎที่ทุกบทใน list มีร่วมกัน */
  function intersectRules(poems) {
    if (!poems.length) return [];
    let common = equalPairs(poems[0]);
    for (const p of poems.slice(1)) {
      const s = equalPairs(p);
      common = new Set([...common].filter((x) => s.has(x)));
    }
    return pairsToRules(common);
  }

  function tokenAt(poem, p) {
    const bat = poem[p.bat - 1];
    const wak = bat && bat[p.wak];
    return wak && p.k < wak.length ? wak[p.k] : null;
  }

  function check(candidate, rules) {
    const results = rules.map((r) => {
      const ta = tokenAt(candidate, r.a), tb = tokenAt(candidate, r.b);
      return { ...r, ta, tb, ok: ta !== null && ta === tb };
    });
    const passed = results.filter((r) => r.ok).length;
    return { score: rules.length ? passed / rules.length : 1, passed, total: rules.length, results };
  }

  /** โครงฉันทลักษณ์: จำนวนพยางค์ต่อวรรค เช่น "5+2 / 5+2 / 5+2+2 / 5+4" */
  function shape(poem) {
    return poem.map((bat) => bat.map((w) => w.length).join("+")).join(" / ");
  }

  const KHLONG_SI_SHAPE = [["5", "2"], ["5", "2"], ["5", "2", "2?"], ["5", "4"]];
  /** เตือนถ้าไม่ตรงโครงโคลงสี่สุภาพ (อนุญาตคำสร้อยบาท 1 และ 3) */
  function khlongWarnings(poem) {
    const warn = [];
    if (poem.length !== 4) warn.push(`มี ${poem.length} บาท (โคลงสี่สุภาพมี 4 บาท)`);
    poem.forEach((bat, i) => {
      const n = bat.map((w) => w.length);
      if (n[0] !== 5) warn.push(`บาท ${i + 1}: วรรคหน้ามี ${n[0]} พยางค์ (ควรเป็น 5)`);
      const back = i === 3 ? 4 : 2;
      if (n.length < 2) warn.push(`บาท ${i + 1}: ไม่มีวรรคหลัง (ใช้ | คั่นวรรค)`);
      else if (n[1] !== back) warn.push(`บาท ${i + 1}: วรรคหลังมี ${n[1]} พยางค์ (ควรเป็น ${back})`);
      if (n.length > 2 && !(i === 0 || i === 2)) warn.push(`บาท ${i + 1}: มีคำสร้อย (ปกติมีเฉพาะบาท 1 และ 3)`);
    });
    return warn;
  }

  /** prev-encoding (Baker): ระยะไปยังตำแหน่งก่อนหน้าที่ใกล้ที่สุดที่เป็นคำเดียวกัน, 0 = พบครั้งแรก */
  function prevDistances(poem) {
    const last = new Map();
    return flattenWithPos(poem).map((t, i) => {
      const d = last.has(t.token) ? i - last.get(t.token) : 0;
      last.set(t.token, i);
      return d;
    });
  }

  /** prev-encoding แยกตามบาท (ใช้ดูลายสัมพัทธ์ที่ไม่ขึ้นกับตำแหน่ง) */
  function prevByBat(poem) {
    const flat = flattenWithPos(poem);
    const d = prevDistances(poem);
    const rows = poem.map(() => []);
    flat.forEach((t, i) => rows[t.pos.bat - 1].push(d[i]));
    return rows;
  }

  // ---------- LoRA-oriented analysis ----------
  /** ชุดคู่ตำแหน่งที่ "ถูกบังคับ" โดยกฎ (closure ของกฎ = ทุกคู่ภายในกลุ่มเดียวกัน) */
  function rulePairs(rules) {
    const groups = new Map();
    for (const r of rules) {
      const a = posKey(r.a), b = posKey(r.b);
      if (!groups.has(a)) groups.set(a, new Set([a]));
      groups.get(a).add(b);
    }
    const order = (x) => { const p = parseKey(x); return p.bat * 1e6 + p.wak * 1e3 + p.k; };
    const pairs = new Set();
    for (const g of groups.values()) {
      const m = [...g].sort((x, y) => order(x) - order(y));
      for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) pairs.add(`${m[i]}|${m[j]}`);
    }
    return pairs;
  }

  /** ตัวชี้วัดของกลอน 1 บท ที่เกี่ยวกับสิ่งที่ LoRA จะต้องเรียน
   *  typeRules = กฎของชนิดกลบท (ใช้แยก "สัญญาณ" ออกจาก "คำซ้ำบังเอิญ") */
  function loraMetrics(poem, typeRules, vocabSize) {
    const flat = flattenWithPos(poem);
    const own = extractRules(poem);
    const dist = prevDistances(poem).filter((d) => d > 0);  // ระยะคัดลอกจากตำแหน่งก่อนหน้าที่ใกล้ที่สุด
    const ownPairs = equalPairs(poem);
    const req = typeRules && typeRules.length ? rulePairs(typeRules) : new Set();
    let reqHit = 0;
    for (const p of req) if (ownPairs.has(p)) reqHit++;
    const sat = typeRules && typeRules.length ? check(poem, typeRules) : null;
    const V = Math.max(2, vocabSize || 3000);
    const signal = sat ? sat.passed : 0;
    return {
      N: flat.length,
      blocks: flat.length - own.length,            // |Π| = จำนวนคำต่างกัน
      ownRules: own.length,                         // |R| = N − |Π|
      same: own.filter((r) => r.kind === "SAME").length,
      cross: own.filter((r) => r.kind === "CROSS").length,
      density: flat.length ? own.length / flat.length : 0,
      meanDist: dist.length ? dist.reduce((a, b) => a + b, 0) / dist.length : 0,
      maxDist: dist.length ? Math.max(...dist) : 0,
      distances: dist,
      ownPairs: ownPairs.size,
      requiredPairs: req.size,
      requiredHit: reqHit,
      noiseRatio: !req.size ? null : ownPairs.size ? 1 - reqHit / ownPairs.size : 0,
      typeScore: sat ? sat.score : null,
      signalRules: signal,
      bits: signal * Math.log2(V),
    };
  }

  /** เมทริกซ์ลักษณะ: แถว = กลอน, คอลัมน์ = คู่ตำแหน่งที่เป็นคำเดียวกัน (0/1) */
  function pairFeatureMatrix(poems) {
    const sets = poems.map(equalPairs);
    const cols = [...new Set(sets.flatMap((s) => [...s]))].sort();
    const M = sets.map((s) => cols.map((c) => (s.has(c) ? 1 : 0)));
    return { M, cols };
  }

  /** ค่าเอกฐาน (singular values) ของ M ผ่าน eigenvalues ของ Gram matrix M Mᵀ (Jacobi) */
  function singularValues(M) {
    const n = M.length;
    if (!n) return [];
    const G = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => M[i].reduce((s, v, k) => s + v * M[j][k], 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += G[p][q] * G[p][q];
      if (off < 1e-18) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(G[p][q]) < 1e-15) continue;
        const theta = (G[q][q] - G[p][p]) / (2 * G[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const gkp = G[k][p], gkq = G[k][q];
          G[k][p] = c * gkp - s * gkq; G[k][q] = s * gkp + c * gkq;
        }
        for (let k = 0; k < n; k++) {
          const gpk = G[p][k], gqk = G[q][k];
          G[p][k] = c * gpk - s * gqk; G[q][k] = s * gpk + c * gqk;
        }
      }
    }
    return G.map((row, i) => Math.sqrt(Math.max(0, row[i]))).sort((a, b) => b - a);
  }

  /** effective rank = exp(H(p)), p_i = σ_i / Σσ */
  function effectiveRank(sv) {
    const s = sv.filter((x) => x > 1e-9);
    const tot = s.reduce((a, b) => a + b, 0);
    if (!tot) return 0;
    const H = -s.reduce((h, x) => h + (x / tot) * Math.log(x / tot), 0);
    return Math.exp(H);
  }

  /** Bell number B_n (จำนวนวิธีแบ่ง n ตำแหน่งเป็นกลุ่ม = จำนวนลายที่เป็นไปได้) */
  function bell(n) {
    let row = [1n];
    for (let i = 0; i < n; i++) {
      const next = [row[row.length - 1]];
      for (const v of row) next.push(next[next.length - 1] + v);
      row = next;
    }
    return row[0];
  }

  // ---------- attention comparison ----------
  /** attention ในอุดมคติ: ครึ่งล่างของ equality matrix (รวมเส้นทแยง) normalize ต่อแถว */
  function idealAttention(poem) {
    const toks = flattenWithPos(poem).map((t) => t.token);
    return toks.map((ti, i) => {
      const row = toks.map((tj, j) => (j <= i && tj === ti ? 1 : 0));
      const s = row.reduce((a, b) => a + b, 0);
      return row.map((v) => v / s);
    });
  }

  /** วัด attention ที่ตกบนตำแหน่งต้นทางของแต่ละกฎ
   *  A = matrix N×N (แถว = query, คอลัมน์ = key) · shift = ใช้แถว b−1 (การทำนาย token ถัดไป) */
  function ruleAttention(A, poem, rules, shift) {
    const flat = flattenWithPos(poem);
    const idx = new Map(flat.map((t, i) => [posKey(t.pos), i]));
    const out = [];
    for (const r of rules) {
      const a = idx.get(posKey(r.a)), b = idx.get(posKey(r.b));
      if (a === undefined || b === undefined) continue;
      const row = shift ? b - 1 : b;
      if (row < 0 || !A[row] || a > row) continue;
      const causal = A[row].slice(0, row + 1).map((v) => Math.max(0, Number(v) || 0));
      const tot = causal.reduce((x, y) => x + y, 0) || 1;
      const value = causal[a] / tot;
      const baseline = 1 / (row + 1);
      const rank = 1 + causal.filter((v) => v > causal[a]).length;
      out.push({ ...r, ia: a, ib: b, row, value, baseline, lift: value / baseline, rank });
    }
    const summ = (xs) => xs.length ? {
      n: xs.length,
      mean: xs.reduce((s, x) => s + x.value, 0) / xs.length,
      lift: xs.reduce((s, x) => s + x.lift, 0) / xs.length,
      top1: xs.filter((x) => x.rank === 1).length / xs.length,
    } : null;
    return { rules: out, all: summ(out), same: summ(out.filter((x) => x.kind === "SAME")), cross: summ(out.filter((x) => x.kind === "CROSS")) };
  }

  const api = {
    WAK_NAMES, parsePoem, poemToText, posKey, posLabel, flattenWithPos,
    poemFirstOccurrence, letterPattern, backReferences, extractRules,
    equalPairs, pairsToRules, intersectRules, tokenAt, check, shape, khlongWarnings,
    rulePairs, loraMetrics, pairFeatureMatrix, singularValues, effectiveRank, bell,
    prevDistances, prevByBat, idealAttention, ruleAttention,
  };
  root.Kloang = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
