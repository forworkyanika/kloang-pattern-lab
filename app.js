/* Kloang Pattern Lab — UI */
(function () {
  "use strict";
  const K = window.Kloang;
  const STORAGE_KEY = "kloang-pattern-lab:v1";

  const SAMPLES = [
    {
      name: "กลโคลงดาวล้อมเดือน (ต้นฉบับ)",
      ref: true, test: true,
      text: "ผล บุญ บุญ เกื้อ กอบ | ยศ ศักดิ์\nผล บาป บาป คง ชัก | ชั่ว ให้\nผล สัตย์ สัตย์ ประ จักษ์ | คุณ แน่ | นา พ่อ\nผล เท็จ เท็จ โทษ ได้ | เที่ยง แท้ แก่ ตน",
    },
    {
      name: "ลายเดียวกัน คำใหม่ (ใจ ซ้ำบังเอิญ)",
      ref: false, test: true,
      text: "จิต รัก รัก มั่น คง | สุข ใจ\nจิต ทุกข์ ทุกข์ ร้อน รน | หม่น หมอง\nจิต นิ่ง นิ่ง เย็น ฉ่ำ | ใจ ใส | นา พ่อ\nจิต หลง หลง ทาง ผิด | ภัย พาล ผลาญ ตน",
    },
    {
      name: "ลายเสีย (negative control)",
      ref: false, test: true,
      text: "ผล บุญ บุญ เกื้อ กอบ | ยศ ศักดิ์\nผล บาป บาป คง ชัก | ชั่ว ให้\nเมื่อ สัตย์ สัตย์ ประ จักษ์ | คุณ แน่ | นา พ่อ\nผล เท็จ โทษ ภัย ได้ | เที่ยง แท้ แก่ ตน",
    },
  ];

  // ---------- state ----------
  const uid = () => Math.random().toString(36).slice(2, 10);
  let state = load() || freshState();

  function freshState() {
    const poems = SAMPLES.map((s) => ({ id: uid(), ...s }));
    return { poems, selectedId: poems[0].id, disabledRules: [] };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!Array.isArray(s.poems) || !s.poems.length) return null;
      s.disabledRules = s.disabledRules || [];
      return s;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode etc. */ }
  }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const selected = () => state.poems.find((p) => p.id === state.selectedId) || state.poems[0];
  const parsed = (p) => K.parsePoem(p.text);
  const ruleKey = (r) => `${K.posKey(r.a)}>${K.posKey(r.b)}`;

  // ---------- derived ----------
  function currentRules() {
    const refs = state.poems.filter((p) => p.ref);
    const all = K.intersectRules(refs.map(parsed).filter((x) => x.length));
    const disabled = new Set(state.disabledRules);
    return { refs, all, active: all.filter((r) => !disabled.has(ruleKey(r))) };
  }

  // ---------- render ----------
  function render() {
    const rules = currentRules();
    renderLibrary(rules);
    renderEditor();
    renderRules(rules);
    renderResults(rules);
    renderDetail(rules);
    save();
  }

  function renderLibrary(rules) {
    const ul = $("poem-list");
    ul.innerHTML = "";
    for (const p of state.poems) {
      const li = document.createElement("li");
      if (p.id === state.selectedId) li.classList.add("selected");
      const score = rules.active.length && p.test ? K.check(parsed(p), rules.active).score : null;
      li.innerHTML = `
        <span><input type="checkbox" data-role="ref" ${p.ref ? "checked" : ""} aria-label="ใช้เป็นต้นแบบ"></span>
        <span><input type="checkbox" data-role="test" ${p.test ? "checked" : ""} aria-label="ทดสอบ"></span>
        <span class="pname">${esc(p.name || "(ไม่มีชื่อ)")}${score !== null ? `<span class="pscore">${Math.round(score * 100)}%</span>` : ""}</span>`;
      li.addEventListener("click", (e) => {
        const role = e.target.dataset && e.target.dataset.role;
        if (role) { p[role] = e.target.checked; render(); return; }
        state.selectedId = p.id; render();
      });
      ul.appendChild(li);
    }
  }

  function renderEditor() {
    const p = selected();
    const nameEl = $("poem-name"), textEl = $("poem-text");
    if (document.activeElement !== nameEl) nameEl.value = p.name;
    if (document.activeElement !== textEl) textEl.value = p.text;
    textEl.rows = Math.max(5, p.text.split("\n").length + 1);
    const poem = parsed(p);
    const meta = $("poem-meta");
    if (!poem.length) { meta.innerHTML = `<span class="warn">ยังไม่มีเนื้อกลอน</span>`; return; }
    const n = K.flattenWithPos(poem).length;
    const warns = K.khlongWarnings(poem);
    meta.innerHTML = `${poem.length} บาท · ${n} พยางค์ · โครง <code>${esc(K.shape(poem))}</code> · ` +
      (warns.length
        ? `<span class="warn">ไม่ตรงโครงโคลงสี่สุภาพ: ${warns.map(esc).join("; ")}</span>`
        : `<span class="good">ตรงโครงโคลงสี่สุภาพ</span>`);
  }

  function patternHTML(poem) {
    return `<div class="pattern">${K.letterPattern(poem)
      .map((row, i) => `<div class="bat"><span class="bat-no">บาท ${i + 1}</span><span>${esc(row)}</span></div>`)
      .join("")}</div>`;
  }

  function renderRules(rules) {
    const src = $("rule-source"), list = $("rule-list"), pat = $("ref-pattern");
    if (!rules.refs.length) {
      src.textContent = "";
      pat.innerHTML = `<p class="empty">ยังไม่ได้เลือกต้นแบบ — ติ๊กช่อง “ต้นแบบ” ในคลังกลอนอย่างน้อย 1 บท</p>`;
      list.innerHTML = "";
      return;
    }
    src.textContent = rules.refs.length === 1
      ? `— จาก “${rules.refs[0].name}”`
      : `— กฎร่วมของ ${rules.refs.length} บทต้นแบบ`;
    pat.innerHTML = rules.refs.length === 1 ? patternHTML(parsed(rules.refs[0])) : "";
    const disabled = new Set(state.disabledRules);
    const refPoem = parsed(rules.refs[0]);
    list.innerHTML = rules.all.length ? "" : `<li class="empty">ไม่มีกฎร่วม — ต้นแบบไม่มีคู่ตำแหน่งที่ซ้ำกันเหมือนกันเลย</li>`;
    for (const r of rules.all) {
      const key = ruleKey(r);
      const li = document.createElement("li");
      if (disabled.has(key)) li.classList.add("off");
      const tok = K.tokenAt(refPoem, r.a);
      li.innerHTML = `<input type="checkbox" ${disabled.has(key) ? "" : "checked"} aria-label="เปิด/ปิดกฎ">
        <span class="tag ${r.kind}">${r.kind}</span>
        <span class="pos">${K.posLabel(r.a)} = ${K.posLabel(r.b)}</span>
        <span class="muted">${tok ? esc(tok) : ""}</span>`;
      li.querySelector("input").addEventListener("change", (e) => {
        const set = new Set(state.disabledRules);
        e.target.checked ? set.delete(key) : set.add(key);
        state.disabledRules = [...set];
        render();
      });
      list.appendChild(li);
    }
  }

  function renderResults(rules) {
    const body = $("results-body");
    const tests = state.poems.filter((p) => p.test);
    if (!tests.length || !rules.active.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty">${!rules.active.length ? "ยังไม่มีกฎที่เปิดใช้" : "ยังไม่ได้ติ๊ก “ทดสอบ” กลอนใด"}</td></tr>`;
      return;
    }
    const refPattern = rules.refs.length === 1 ? JSON.stringify(K.letterPattern(parsed(rules.refs[0]))) : null;
    body.innerHTML = "";
    for (const p of tests) {
      const poem = parsed(p);
      const res = K.check(poem, rules.active);
      const pct = Math.round(res.score * 100);
      const cls = pct === 100 ? "" : pct >= 60 ? "mid" : "low";
      const exact = refPattern === null ? "—" : JSON.stringify(K.letterPattern(poem)) === refPattern
        ? `<span class="yes">ตรง</span>` : `<span class="no">ไม่ตรง</span>`;
      const fails = res.results.filter((r) => !r.ok)
        .map((r) => `${K.posLabel(r.a)} ${esc(r.ta ?? "∅")} ≠ ${K.posLabel(r.b)} ${esc(r.tb ?? "∅")}`);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(p.name)}</td>
        <td class="mono">${esc(K.shape(poem))}</td>
        <td><div class="scorebar"><div class="track"><div class="fill ${cls}" style="width:${pct}%"></div></div><b>${pct}%</b></div>
            <span class="muted">${res.passed}/${res.total} ข้อ</span></td>
        <td>${exact}</td>
        <td>${fails.length ? `<div class="fail">${fails.join("<br>")}</div>` : `<span class="yes">ผ่านทุกข้อ</span>`}</td>`;
      tr.addEventListener("click", () => { state.selectedId = p.id; render(); });
      body.appendChild(tr);
    }
  }

  function renderDetail(rules) {
    const p = selected();
    const poem = parsed(p);
    $("detail-name").textContent = p.name;
    if (!poem.length) {
      $("detail-pattern").innerHTML = $("detail-refs").innerHTML = $("matrix").innerHTML = `<p class="empty">ไม่มีข้อมูล</p>`;
      return;
    }
    $("detail-pattern").innerHTML = patternHTML(poem);
    const reps = K.backReferences(poem).filter((t) => t.kind !== "NEW");
    $("detail-refs").innerHTML = reps.length
      ? `<table class="refs">${reps.map((t) => `<tr><td class="mono">${K.posLabel(t.pos)}</td><td>${esc(t.token)}</td>
          <td><span class="tag ${t.kind}">${t.kind}</span></td><td class="mono">→ ${K.posLabel(t.src)}</td></tr>`).join("")}</table>`
      : `<p class="empty">ไม่มีคำซ้ำ</p>`;
    $("matrix").innerHTML = matrixSVG(poem, rules.active);
  }

  function matrixSVG(poem, rules) {
    const flat = K.flattenWithPos(poem);
    const N = flat.length;
    const cell = N > 40 ? 12 : N > 28 ? 15 : 18;
    const pad = 46;
    const size = pad + N * cell + 4;
    const idx = new Map(flat.map((t, i) => [K.posKey(t.pos), i]));
    const res = K.check(poem, rules).results;
    let s = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" font-family="Sarabun, sans-serif">`;
    s += `<rect x="${pad}" y="${pad}" width="${N * cell}" height="${N * cell}" fill="#fbfaf7" stroke="#e3e0d8"/>`;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (flat[i].token === flat[j].token)
        s += `<rect x="${pad + j * cell + 1}" y="${pad + i * cell + 1}" width="${cell - 2}" height="${cell - 2}" fill="${i === j ? "#b9b4a8" : "#1f2328"}" rx="2"/>`;
    }
    for (const r of res) {
      const i = idx.get(K.posKey(r.a)), j = idx.get(K.posKey(r.b));
      if (i === undefined || j === undefined) continue;
      const color = r.ok ? "#1f7a4d" : "#b3261e";
      for (const [y, x] of [[i, j], [j, i]])
        s += `<rect x="${pad + x * cell + 0.5}" y="${pad + y * cell + 0.5}" width="${cell - 1}" height="${cell - 1}" fill="none" stroke="${color}" stroke-width="2" rx="2"><title>${esc(K.posLabel(r.a))} = ${esc(K.posLabel(r.b))}: ${r.ok ? "ผ่าน" : "ไม่ผ่าน"}</title></rect>`;
    }
    for (let i = 1; i < N; i++) if (flat[i].pos.bat !== flat[i - 1].pos.bat) {
      const v = pad + i * cell;
      s += `<line x1="${v}" y1="${pad}" x2="${v}" y2="${pad + N * cell}" stroke="#c0392b" stroke-width="1" opacity=".55"/>`;
      s += `<line x1="${pad}" y1="${v}" x2="${pad + N * cell}" y2="${v}" stroke="#c0392b" stroke-width="1" opacity=".55"/>`;
    }
    const fs = Math.max(8, cell - 6);
    flat.forEach((t, i) => {
      const c = pad + i * cell + cell / 2;
      s += `<text x="${pad - 4}" y="${c + fs / 3}" font-size="${fs}" text-anchor="end" fill="#444">${esc(t.token)}</text>`;
      s += `<text transform="translate(${c + fs / 3},${pad - 4}) rotate(-90)" font-size="${fs}" fill="#444">${esc(t.token)}</text>`;
    });
    return s + "</svg>";
  }

  // ---------- events ----------
  $("poem-name").addEventListener("input", (e) => { selected().name = e.target.value; render(); });
  $("poem-text").addEventListener("input", (e) => { selected().text = e.target.value; render(); });

  $("btn-new").addEventListener("click", () => {
    const p = { id: uid(), name: `กลอนใหม่ ${state.poems.length + 1}`, text: "", ref: false, test: true };
    state.poems.push(p);
    state.selectedId = p.id;
    render();
    $("poem-text").focus();
  });

  $("btn-delete").addEventListener("click", () => {
    const p = selected();
    if (state.poems.length <= 1) { alertInline("ต้องมีกลอนอย่างน้อย 1 บท"); return; }
    if (!window.confirm(`ลบ “${p.name}” ?`)) return;
    state.poems = state.poems.filter((x) => x.id !== p.id);
    state.selectedId = state.poems[0].id;
    render();
  });

  $("btn-reset").addEventListener("click", () => {
    if (!window.confirm("คืนค่าตัวอย่าง? กลอนที่เพิ่มเองจะถูกลบ (ส่งออก JSON ไว้ก่อนได้)")) return;
    state = freshState();
    render();
  });

  $("btn-rules-all").addEventListener("click", () => { state.disabledRules = []; render(); });

  $("btn-segment").addEventListener("click", () => {
    const p = selected();
    if (!("Segmenter" in Intl)) { alertInline("เบราว์เซอร์นี้ไม่รองรับการตัดคำอัตโนมัติ"); return; }
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    p.text = p.text.split("\n").map((line) =>
      line.split("|").map((wak) =>
        [...seg.segment(wak.replace(/\s+/g, ""))].filter((x) => x.isWordLike).map((x) => x.segment).join(" ")
      ).join(" | ")
    ).join("\n");
    render();
    alertInline("ตัดคำแล้ว — ตัวตัดคำแบ่งเป็น “คำ” ไม่ใช่ “พยางค์” กรุณาตรวจและเว้นวรรคเพิ่มเอง");
  });

  $("btn-export").addEventListener("click", () => {
    const data = { app: "kloang-pattern-lab", version: 1, exported: new Date().toISOString(),
      poems: state.poems.map(({ name, text, ref, test }) => ({ name, text, ref, test })) };
    download("kloang-poems.json", JSON.stringify(data, null, 2), "application/json");
  });

  $("file-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.poems;
      if (!Array.isArray(list)) throw new Error("no poems");
      const added = list.filter((x) => typeof x.text === "string")
        .map((x) => ({ id: uid(), name: String(x.name || "นำเข้า"), text: x.text, ref: !!x.ref, test: x.test !== false }));
      state.poems.push(...added);
      alertInline(`นำเข้า ${added.length} บท`);
      render();
    } catch (err) {
      alertInline("อ่านไฟล์ไม่ได้ — ต้องเป็น JSON ที่ส่งออกจากหน้านี้");
    }
    e.target.value = "";
  });

  $("btn-csv").addEventListener("click", () => {
    const rules = currentRules();
    const rows = [["name", "shape", "passed", "total", "score", "failed_rules"]];
    for (const p of state.poems.filter((x) => x.test)) {
      const poem = parsed(p);
      const res = K.check(poem, rules.active);
      rows.push([p.name, K.shape(poem), res.passed, res.total, res.score.toFixed(4),
        res.results.filter((r) => !r.ok).map((r) => `${K.posLabel(r.a)}=${K.posLabel(r.b)}`).join("; ")]);
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    download("kloang-results.csv", "﻿" + csv, "text/csv");
  });

  function download(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function alertInline(msg) {
    const meta = $("poem-meta");
    const note = document.createElement("div");
    note.className = "warn";
    note.textContent = msg;
    meta.appendChild(note);
    setTimeout(() => note.remove(), 5000);
  }

  render();
})();
