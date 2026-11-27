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

console.log("all tests passed ✓");
