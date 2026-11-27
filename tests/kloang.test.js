// node tests/kloang.test.js — ตรวจว่า JS ให้ผลเท่ากับ method4_poem_level.py
const assert = require("assert");
const K = require("../kloang.js");

const original = K.parsePoem(`ผล บุญ บุญ เกื้อ กอบ | ยศ ศักดิ์
ผล บาป บาป ชวน ชัก | ชั่ว ให้
ผล สัตย์ สัตย์ ประ จักษ์ | คุณ แน่ | นา พ่อ
ผล เท็จ เท็จ โทษ ได้ | เที่ยง แท้ แก่ ตน`);
const substituted = K.parsePoem(`จิต รัก รัก มั่น คง | สุข ใจ
จิต ทุกข์ ทุกข์ ร้อน รน | หม่น หมอง
จิต นิ่ง นิ่ง เย็น ฉ่ำ | ใจ ใส | นา พ่อ
จิต หลง หลง ทาง ผิด | ภัย พาล ผลาญ ตน`);
const broken = K.parsePoem(`ผล บุญ บุญ เกื้อ กอบ | ยศ ศักดิ์
ผล บาป บาป ชวน ชัก | ชั่ว ให้
เมื่อ สัตย์ สัตย์ ประ จักษ์ | คุณ แน่ | นา พ่อ
ผล เท็จ โทษ ภัย ได้ | เที่ยง แท้ แก่ ตน`);

// letter pattern (ตรงกับ Python)
assert.deepStrictEqual(K.letterPattern(original), [
  "A B B C D | E F",
  "A G G H I | J K",
  "A L L M N | O P | Q R",
  "A S S T U | V W X Y",
]);
assert.strictEqual(K.shape(original), "5+2 / 5+2 / 5+2+2 / 5+4");
assert.deepStrictEqual(K.khlongWarnings(original), []);

// rules: 7 ข้อ (CROSS 3, SAME 4)
const rules = K.extractRules(original);
assert.strictEqual(rules.length, 7);
assert.strictEqual(rules.filter((r) => r.kind === "CROSS").length, 3);
assert.strictEqual(rules.filter((r) => r.kind === "SAME").length, 4);

// check scores: 100%, 100%, 71%
const s1 = K.check(original, rules), s2 = K.check(substituted, rules), s3 = K.check(broken, rules);
assert.strictEqual(s1.score, 1);
assert.strictEqual(s2.score, 1);
assert.strictEqual(s3.passed, 5);
assert.strictEqual(Math.round(s3.score * 100), 71);
const failed = s3.results.filter((r) => !r.ok).map((r) => `${K.posLabel(r.a)}=${K.posLabel(r.b)}`);
assert.deepStrictEqual(failed, ["บ1.ว0.0=บ3.ว0.0", "บ4.ว0.1=บ4.ว0.2"]);

// exact letter pattern: substituted ไม่ตรง (เพราะ ใจ ซ้ำบังเอิญ) แต่ผ่านกฎ
assert.notDeepStrictEqual(K.letterPattern(substituted), K.letterPattern(original));

// intersection: original ∩ substituted = 7 กฎเดิม (ใจ ซ้ำบังเอิญถูกตัดออก)
const inter = K.intersectRules([original, substituted]);
assert.strictEqual(inter.length, 7);
// substituted มี ใจ ซ้ำ → กฎของมันเองมี 8 ข้อ
assert.strictEqual(K.extractRules(substituted).length, 8);
// rules จาก pairsToRules ของบทเดียว = extractRules
assert.deepStrictEqual(
  K.intersectRules([original]).map((r) => `${K.posKey(r.a)}>${K.posKey(r.b)}`).sort(),
  rules.map((r) => `${K.posKey(r.a)}>${K.posKey(r.b)}`).sort()
);

// warnings
assert.ok(K.khlongWarnings(K.parsePoem("ผล บุญ | ยศ")).length > 0);
// out-of-range position → fail, ไม่ crash
assert.strictEqual(K.check(K.parsePoem("ผล บุญ"), rules).passed, 0);

// ---- v2: ไม้ยมก, prev-encoding, LoRA metrics, SVD, Bell ----
assert.deepStrictEqual(K.parsePoem("คิด ถึง ๆ มาท แม้น | ไป่ สม"), [[["คิด", "ถึง", "ถึง", "มาท", "แม้น"], ["ไป่", "สม"]]]);
assert.deepStrictEqual(K.parsePoem("หวั่นๆ สะ ดุ้ง"), [[["หวั่น", "หวั่น", "สะ", "ดุ้ง"]]]);
// prev-encoding กับ first-occurrence กำหนด partition เดียวกัน: จำนวนตำแหน่งที่ d>0 = |R|
const d = K.prevDistances(original);
assert.strictEqual(d.filter((x) => x > 0).length, K.extractRules(original).length);
assert.deepStrictEqual(K.prevByBat(original)[1], [7, 0, 1, 0, 0, 0, 0]); // ผล บาท 2 ห่างจาก ผล บาท 1 = 7
// |R| = N − |Π|
const m = K.loraMetrics(original, rules, 1024);
assert.strictEqual(m.N, 32);
assert.strictEqual(m.blocks, 25);
assert.strictEqual(m.ownRules, 7);
assert.strictEqual(m.same, 4);
assert.strictEqual(m.cross, 3);
assert.strictEqual(m.noiseRatio, 0);
assert.strictEqual(m.typeScore, 1);
assert.strictEqual(m.bits, 7 * 10); // 7 กฎ × log2(1024)
// คำซ้ำบังเอิญ: positive control มี ใจ ซ้ำ → noise > 0
const ms = K.loraMetrics(substituted, rules, 1024);
assert.ok(ms.noiseRatio > 0);
assert.strictEqual(ms.typeScore, 1);
// SVD: singular values ของ [[3,0],[0,4]] = 4,3 ; effective rank ของค่าเท่ากัน 3 ค่า = 3
const sv = K.singularValues([[3, 0], [0, 4]]);
assert.ok(Math.abs(sv[0] - 4) < 1e-9 && Math.abs(sv[1] - 3) < 1e-9);
assert.ok(Math.abs(K.effectiveRank([1, 1, 1]) - 3) < 1e-9);
assert.ok(Math.abs(K.effectiveRank([5]) - 1) < 1e-9);
// SVD ของเมทริกซ์ทั่วไป: ผลรวม σ² = Frobenius²
const Mx = [[1, 0, 1], [1, 1, 0], [0, 1, 1], [1, 1, 1]];
const svx = K.singularValues(Mx);
const fro = Mx.flat().reduce((a, b) => a + b * b, 0);
assert.ok(Math.abs(svx.reduce((a, b) => a + b * b, 0) - fro) < 1e-9);
// Bell numbers
assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map((n) => Number(K.bell(n))), [1, 1, 2, 5, 15, 52]);
assert.strictEqual(K.bell(32).toString(), "128064670049908713818925644");

// ---- ตัวอย่างใน data.js ----
global.window = global;
require("../data.js");
const S = global.KLOANG_SAMPLES;
assert.strictEqual(S.length, 12);
for (const s of S) assert.ok(K.parsePoem(s.text).length === 4, `${s.name} ต้องมี 4 บาท`);
const byType = (t) => S.filter((s) => s.type === t).map((s) => K.parsePoem(s.text));
assert.strictEqual(K.intersectRules(byType("ดาวล้อมเดือน")).length, 7);
assert.strictEqual(K.intersectRules(byType("ซ้ำสองแสนง")).length, 1); // ตำแหน่งแปรผัน
const wua = K.extractRules(byType("วัวพันหลัก")[0]);
assert.ok(wua.length === 3 && wua.every((r) => r.kind === "CROSS"));

// ---- attention comparison ----
const ideal = K.idealAttention(original);
assert.strictEqual(ideal.length, 32);
ideal.forEach((row, i) => {
  assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-12);       // normalize ต่อแถว
  assert.ok(row.slice(i + 1).every((v) => v === 0));                       // causal
});
const ra = K.ruleAttention(ideal, original, K.extractRules(original), false);
assert.strictEqual(ra.all.n, 7);
assert.strictEqual(ra.all.top1, 1);              // attention ในอุดมคติ: ต้นทางได้อันดับ 1 ทุกกฎ
assert.strictEqual(ra.same.n, 4);
assert.strictEqual(ra.cross.n, 3);
// attention แบบสุ่มเท่ากัน → lift = 1
const uniform = ideal.map((row, i) => row.map((_, j) => (j <= i ? 1 / (i + 1) : 0)));
assert.ok(Math.abs(K.ruleAttention(uniform, original, K.extractRules(original), false).all.lift - 1) < 1e-12);

console.log("all tests passed ✓");
