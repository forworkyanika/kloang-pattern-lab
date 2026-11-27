/* Kloang Pattern Lab — poem-level first-occurrence encoding (Method 4+)
 * พอร์ตจาก method4_poem_level.py ให้ผลตรงกันทุกฟังก์ชัน
 * โครงสร้างกลอน: poem = [ บาท = [ วรรค = [พยางค์, ...], ... ], ... ]
 */
(function (root) {
  "use strict";

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const WAK_NAMES = ["วรรคหน้า", "วรรคหลัง", "คำสร้อย"];

  // ---------- parsing ----------
  /** แปลงข้อความเป็นกลอน: 1 บรรทัด = 1 บาท, "|" คั่นวรรค, ช่องว่างคั่นพยางค์ */
  function parsePoem(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) =>
        line
          .split("|")
          .map((wak) => wak.trim().split(/\s+/).filter(Boolean))
          .filter((wak) => wak.length > 0)
      )
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

  const api = {
    WAK_NAMES, parsePoem, poemToText, posKey, posLabel, flattenWithPos,
    poemFirstOccurrence, letterPattern, backReferences, extractRules,
    equalPairs, pairsToRules, intersectRules, tokenAt, check, shape, khlongWarnings,
  };
  root.Kloang = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
