/* Kloang Pattern Lab — UI */
(function () {
  "use strict";
  const K = window.Kloang;
  const SAMPLES = window.KLOANG_SAMPLES || [];
  const EXCLUDED = window.KLOANG_EXCLUDED || [];
  const STORAGE_KEY = "kloang-pattern-lab:v2";
  const OLD_KEY = "kloang-pattern-lab:v1";

  // ---------- state ----------
  const uid = () => Math.random().toString(36).slice(2, 10);
  const sampleNames = new Set(SAMPLES.map((s) => s.name));

  function freshState() {
    const poems = SAMPLES.map((s) => ({ id: uid(), ...s }));
    return { poems, selectedId: poems[0].id, disabledRules: [], vocab: 3000 };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.poems) && s.poems.length) {
          s.disabledRules = s.disabledRules || [];
          s.vocab = s.vocab || 3000;
          return s;
        }
      }
      // ย้ายกลอนที่ผู้ใช้เพิ่มเองจากเวอร์ชันก่อน
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const o = JSON.parse(old);
        const st = freshState();
        const OLD_SAMPLE_NAMES = ["กลโคลงดาวล้อมเดือน (ต้นฉบับ)", "ลายเดียวกัน คำใหม่ (ใจ ซ้ำบังเอิญ)", "ลายเสีย (negative control)"];
        for (const p of o.poems || []) {
          if (OLD_SAMPLE_NAMES.includes(p.name) || sampleNames.has(p.name)) continue;
          st.poems.push({ id: uid(), name: p.name, text: p.text, type: "", ref: false, test: !!p.test, role: "ผู้ใช้เพิ่ม" });
        }
        return st;
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  let state = load() || freshState();
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const selected = () => state.poems.find((p) => p.id === state.selectedId) || state.poems[0];
  const parsed = (p) => K.parsePoem(p.text);
  const ruleKey = (r) => `${K.posKey(r.a)}>${K.posKey(r.b)}`;
  const isRealType = (t) => t && t !== "control";
  const pct = (x) => `${Math.round(x * 100)}%`;
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s·]+)/g, '<a href="$1" target="_blank" rel="noopener">ลิงก์</a>');

  // ---------- derived ----------
  function currentRules() {
    const refs = state.poems.filter((p) => p.ref);
    const all = K.intersectRules(refs.map(parsed).filter((x) => x.length));
    const disabled = new Set(state.disabledRules);
    return { refs, all, active: all.filter((r) => !disabled.has(ruleKey(r))) };
  }
  function typeGroups() {
    const g = new Map();
    for (const p of state.poems) {
      if (!isRealType(p.type) || !parsed(p).length) continue;
      if (!g.has(p.type)) g.set(p.type, []);
      g.get(p.type).push(p);
    }
    return g;
  }
  function typeRuleMap() {
    const m = new Map();
    for (const [t, ps] of typeGroups()) m.set(t, K.intersectRules(ps.map(parsed)));
    return m;
  }

  // ---------- tabs ----------
  function showTab(name) {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".tab-page").forEach((s) => s.classList.toggle("active", s.id === `tab-${name}`));
    if (name === "lora") renderLora();
    if (name === "math") renderMath();
    if (history.replaceState) history.replaceState(null, "", `#${name}`);
  }
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-goto]");
    if (!t) return;
    e.preventDefault();
    showTab(t.dataset.goto);
    const href = t.getAttribute("href");
    const el = href && href.length > 1 && href.startsWith("#") ? document.querySelector(href) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0 });
  });

  let mathDone = false;
  function renderMath() {
    if (mathDone || typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement($("tab-math"), {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }],
      throwOnError: false,
    });
    mathDone = true;
  }

  // ---------- LAB render ----------
  function render() {
    const rules = currentRules();
    renderLibrary(rules);
    renderEditor();
    renderRules(rules);
    renderResults(rules);
    renderDetail(rules);
    if ($("tab-lora").classList.contains("active")) renderLora();
    save();
  }

  function renderLibrary(rules) {
    const ul = $("poem-list");
    ul.innerHTML = "";
    for (const p of state.poems) {
      const li = document.createElement("li");
      if (p.id === state.selectedId) li.classList.add("selected");
      const score = rules.active.length && p.test ? K.check(parsed(p), rules.active).score : null;
      li.title = p.type ? `ชนิด: ${p.type}` : "";
      li.innerHTML = `
        <span><input type="checkbox" data-role="ref" ${p.ref ? "checked" : ""} aria-label="ใช้เป็นต้นแบบ"></span>
        <span><input type="checkbox" data-role="test" ${p.test ? "checked" : ""} aria-label="ทดสอบ"></span>
        <span class="pname">${esc(p.name || "(ไม่มีชื่อ)")}${score !== null ? `<span class="pscore">${pct(score)}</span>` : ""}</span>`;
      li.addEventListener("click", (e) => {
        const role = e.target.dataset && e.target.dataset.role;
        if (role) { p[role] = e.target.checked; render(); return; }
        state.selectedId = p.id; render();
      });
      ul.appendChild(li);
    }
    const types = [...new Set(state.poems.map((p) => p.type).filter(Boolean))];
    $("type-options").innerHTML = types.map((t) => `<option value="${esc(t)}">`).join("");
  }

  function renderEditor() {
    const p = selected();
    const nameEl = $("poem-name"), textEl = $("poem-text"), typeEl = $("poem-type");
    if (document.activeElement !== nameEl) nameEl.value = p.name || "";
    if (document.activeElement !== typeEl) typeEl.value = p.type || "";
    if (document.activeElement !== textEl) textEl.value = p.text || "";
    textEl.rows = Math.max(5, (p.text || "").split("\n").length + 1);
    const poem = parsed(p);
    const meta = $("poem-meta");
    if (!poem.length) meta.innerHTML = `<span class="warn">ยังไม่มีเนื้อกลอน</span>`;
    else {
      const n = K.flattenWithPos(poem).length;
      const warns = K.khlongWarnings(poem);
      meta.innerHTML = `${poem.length} บาท · ${n} หน่วย · โครง <code>${esc(K.shape(poem))}</code> · ` +
        (warns.length ? `<span class="soft">ไม่ตรงโครงโคลงสี่สุภาพมาตรฐาน: ${warns.map(esc).join("; ")}</span>`
          : `<span class="good">ตรงโครงโคลงสี่สุภาพ</span>`);
    }
    const info = [];
    if (p.role === "negative control") info.push(`<span class="tag NEG">negative control</span> <a href="#controls" data-goto="purpose">นี่คืออะไร?</a>`);
    if (p.role === "positive control") info.push(`<span class="tag POS">positive control</span>`);
    if (p.rule) info.push(`<b>กล:</b> ${esc(p.rule)}`);
    if (p.note) info.push(`<b>หมายเหตุ:</b> ${esc(p.note)}`);
    if (p.source) info.push(`<b>ที่มา:</b> ${linkify(p.source)}`);
    $("poem-info").innerHTML = info.map((x) => `<div>${x}</div>`).join("");
  }

  function patternHTML(poem) {
    return `<div class="pattern">${K.letterPattern(poem)
      .map((row, i) => `<div class="bat"><span class="bat-no">บาท ${i + 1}</span><span>${esc(row)}</span></div>`).join("")}</div>`;
  }

  function renderRules(rules) {
    const src = $("rule-source"), list = $("rule-list"), pat = $("ref-pattern");
    if (!rules.refs.length) {
      src.textContent = "";
      pat.innerHTML = `<p class="empty">ยังไม่ได้เลือกต้นแบบ — ติ๊กช่อง “ต้นแบบ” ในคลังกลอนอย่างน้อย 1 บท</p>`;
      list.innerHTML = "";
      return;
    }
    src.textContent = rules.refs.length === 1 ? `— จาก “${rules.refs[0].name}”` : `— กฎร่วม (meet) ของ ${rules.refs.length} บทต้นแบบ`;
    pat.innerHTML = rules.refs.length === 1 ? patternHTML(parsed(rules.refs[0])) : "";
    const disabled = new Set(state.disabledRules);
    const refPoem = parsed(rules.refs[0]);
    list.innerHTML = rules.all.length ? "" : `<li class="empty">ไม่มีกฎร่วม — ต้นแบบไม่มีคู่ตำแหน่งที่ซ้ำเหมือนกันเลย</li>`;
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
      body.innerHTML = `<tr><td colspan="6" class="empty">${!rules.active.length ? "ยังไม่มีกฎที่เปิดใช้" : "ยังไม่ได้ติ๊ก “ทดสอบ” กลอนใด"}</td></tr>`;
      return;
    }
    const refPattern = rules.refs.length === 1 ? JSON.stringify(K.letterPattern(parsed(rules.refs[0]))) : null;
    body.innerHTML = "";
    for (const p of tests) {
      const poem = parsed(p);
      const res = K.check(poem, rules.active);
      const pc = Math.round(res.score * 100);
      const cls = pc === 100 ? "" : pc >= 60 ? "mid" : "low";
      const exact = refPattern === null ? "—" : JSON.stringify(K.letterPattern(poem)) === refPattern
        ? `<span class="yes">ตรง</span>` : `<span class="no">ไม่ตรง</span>`;
      const fails = res.results.filter((r) => !r.ok)
        .map((r) => `${K.posLabel(r.a)} ${esc(r.ta ?? "∅")} ≠ ${K.posLabel(r.b)} ${esc(r.tb ?? "∅")}`);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(p.name)}${p.role && p.role.includes("control") ? ` <span class="tag ${p.role.startsWith("neg") ? "NEG" : "POS"}">${esc(p.role)}</span>` : ""}</td>
        <td>${esc(p.type || "—")}</td>
        <td class="mono">${esc(K.shape(poem))}</td>
        <td><div class="scorebar"><div class="track"><div class="fill ${cls}" style="width:${pc}%"></div></div><b>${pc}%</b></div>
            <span class="muted">${res.passed}/${res.total} ข้อ</span></td>
        <td>${exact}</td>
        <td>${fails.length ? `<div class="fail">${fails.slice(0, 4).join("<br>")}${fails.length > 4 ? `<br>… อีก ${fails.length - 4} ข้อ` : ""}</div>` : `<span class="yes">ผ่านทุกข้อ</span>`}</td>`;
      tr.addEventListener("click", () => { state.selectedId = p.id; render(); });
      body.appendChild(tr);
    }
  }

  function renderDetail(rules) {
    const p = selected();
    const poem = parsed(p);
    $("detail-name").textContent = p.name;
    if (!poem.length) {
      ["detail-pattern", "detail-prev", "detail-refs", "matrix"].forEach((id) => { $(id).innerHTML = `<p class="empty">ไม่มีข้อมูล</p>`; });
      return;
    }
    $("detail-pattern").innerHTML = patternHTML(poem);
    $("detail-prev").innerHTML = `<div class="pattern">${K.prevByBat(poem)
      .map((row, i) => `<div class="bat"><span class="bat-no">บาท ${i + 1}</span><span>[${row.join(", ")}]</span></div>`).join("")}</div>`;
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
    const pad = 50;
    const size = pad + N * cell + 4;
    const idx = new Map(flat.map((t, i) => [K.posKey(t.pos), i]));
    const res = K.check(poem, rules).results;
    let s = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" font-family="Sarabun, sans-serif" role="img" aria-label="equality matrix">`;
    s += `<rect x="${pad}" y="${pad}" width="${N * cell}" height="${N * cell}" fill="#fbfaf7" stroke="#e3e0d8"/>`;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (flat[i].token === flat[j].token)
        s += `<rect x="${pad + j * cell + 1}" y="${pad + i * cell + 1}" width="${cell - 2}" height="${cell - 2}" fill="${i === j ? "#c9c4b8" : "#1f2328"}" rx="2"/>`;
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
      s += `<line x1="${v}" y1="${pad}" x2="${v}" y2="${pad + N * cell}" stroke="#c0392b" stroke-width="1" opacity=".5"/>`;
      s += `<line x1="${pad}" y1="${v}" x2="${pad + N * cell}" y2="${v}" stroke="#c0392b" stroke-width="1" opacity=".5"/>`;
    }
    const fs = Math.max(8, cell - 6);
    flat.forEach((t, i) => {
      const c = pad + i * cell + cell / 2;
      s += `<text x="${pad - 4}" y="${c + fs / 3}" font-size="${fs}" text-anchor="end" fill="#444">${esc(t.token)}</text>`;
      s += `<text transform="translate(${c + fs / 3},${pad - 4}) rotate(-90)" font-size="${fs}" fill="#444">${esc(t.token)}</text>`;
    });
    return s + "</svg>";
  }

  // ---------- LoRA analysis ----------
  function distanceKinds(poem) {
    const flat = K.flattenWithPos(poem);
    const d = K.prevDistances(poem);
    return d.map((x, i) => (x > 0 ? { d: x, kind: flat[i - x].pos.bat === flat[i].pos.bat ? "SAME" : "CROSS" } : null)).filter(Boolean);
  }

  function loraTags(m, p, typeCount, variable) {
    const tags = [];
    if (m.distances.length && Math.max(...m.distances) <= 2)
      tags.push({ c: "ok", t: "คัดลอกระยะใกล้ (Δ ≤ 2) — คาดว่าเรียนง่าย LoRA น่าจะต้องปรับน้อย" });
    if (m.maxDist >= 8) tags.push({ c: "warn", t: `มีคัดลอกระยะไกล (Δ สูงสุด ${m.maxDist}) — เรียนยากกว่า ต้องการตัวอย่างมากขึ้น` });
    if (m.cross > 0 && m.same === 0) tags.push({ c: "info", t: "ลายข้ามบาทล้วน — ต้องจำข้ามบรรทัด" });
    if (isRealType(p.type) && typeCount === 1) tags.push({ c: "warn", t: "ชนิดนี้มีบทเดียว: กฎของชนิดยังปนคำซ้ำบังเอิญ" });
    else if (m.noiseRatio > 0 && variable) tags.push({ c: "info", t: `คู่ซ้ำ ${pct(m.noiseRatio)} อยู่นอกกฎพิกัดตายตัว — ชนิดนี้ตำแหน่งแปรผัน จึงไม่ใช่คำซ้ำบังเอิญทั้งหมด` });
    else if (m.noiseRatio > 0) tags.push({ c: "warn", t: `คำซ้ำบังเอิญ ${pct(m.noiseRatio)} ของคู่ซ้ำ — เสี่ยงถูกเรียนเป็นกฎปลอม` });
    if (m.typeScore !== null && m.typeScore < 1) tags.push({ c: "bad", t: "ไม่ผ่านกฎร่วมของชนิดตัวเอง — ตรวจการแบ่งหน่วย/การสะกด หรือเป็นลายตำแหน่งแปรผัน" });
    if (m.density < 0.12) tags.push({ c: "info", t: `สัญญาณลายต่อหน่วยต่ำ (ρ=${m.density.toFixed(2)}) — พิจารณา loss weighting` });
    if (p.role === "negative control") tags.push({ c: "info", t: "control — ไม่ควรใส่ในชุดเทรน ใช้สำหรับประเมินเท่านั้น" });
    return tags;
  }

  function renderLora() {
    const V = Number($("vocab-size").value) || state.vocab || 3000;
    const tests = state.poems.filter((p) => p.test && parsed(p).length);
    const groups = typeGroups();
    const trm = typeRuleMap();
    const body = $("lora-body");
    if (!tests.length) {
      body.innerHTML = `<tr><td colspan="10" class="empty">ยังไม่ได้ติ๊ก “ทดสอบ” กลอนใดในแท็บทดลอง</td></tr>`;
      $("type-body").innerHTML = ""; $("sv-chart").innerHTML = ""; $("dist-chart").innerHTML = ""; $("lora-recs").innerHTML = "";
      $("lora-lead").textContent = "";
      return;
    }
    const variableTypes = new Set();
    for (const [t, ps] of groups) {
      const avgOwn = ps.reduce((s, q) => s + K.extractRules(parsed(q)).length, 0) / ps.length;
      if (ps.length > 1 && (trm.get(t) || []).length < 0.5 * avgOwn) variableTypes.add(t);
    }
    const rows = tests.map((p) => {
      const poem = parsed(p);
      const tr = isRealType(p.type) ? trm.get(p.type) || [] : [];
      const m = K.loraMetrics(poem, tr, V);
      return { p, poem, m, typeCount: isRealType(p.type) ? (groups.get(p.type) || []).length : 0 };
    });

    body.innerHTML = rows.map(({ p, m, typeCount }) => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.type || "—")}</td>
        <td class="num">${m.N}</td>
        <td class="num">${m.ownRules} <span class="muted">(${m.same}/${m.cross})</span></td>
        <td class="num">${m.density.toFixed(2)}</td>
        <td class="num">${m.meanDist.toFixed(1)} / ${m.maxDist}</td>
        <td class="num">${m.noiseRatio === null ? "—" : pct(m.noiseRatio)}</td>
        <td class="num">${m.typeScore === null ? "—" : pct(m.typeScore)}</td>
        <td class="num">${m.bits ? m.bits.toFixed(0) : "—"}</td>
        <td>${loraTags(m, p, typeCount, variableTypes.has(p.type)).map((t) => `<div class="ltag ${t.c}">${esc(t.t)}</div>`).join("")}</td>
      </tr>`).join("");

    // type summary
    const typeRows = [...groups.entries()].map(([t, ps]) => {
      const meet = trm.get(t) || [];
      const avgOwn = ps.reduce((s, p) => s + K.extractRules(parsed(p)).length, 0) / ps.length;
      let status, cls;
      if (ps.length === 1) { status = "บทเดียว — แยกกฎจริงออกจากคำซ้ำบังเอิญยังไม่ได้"; cls = "warn"; }
      else if (meet.length < 0.5 * avgOwn) { status = "ตำแหน่งแปรผัน — กฎพิกัดตายตัวจับได้ไม่หมด ควรใช้ลายสัมพัทธ์ (prev-encoding)"; cls = "info"; }
      else { status = "สม่ำเสมอ — กฎร่วมชัดเจน"; cls = "ok"; }
      return { t, n: ps.length, meet: meet.length, avgOwn, status, cls };
    }).sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, "th"));
    $("type-body").innerHTML = typeRows.map((r) => `<tr><td>${esc(r.t)}</td><td class="num">${r.n}</td><td class="num">${r.meet}</td>
      <td class="num">${r.avgOwn.toFixed(1)}</td><td><div class="ltag ${r.cls}">${esc(r.status)}</div></td></tr>`).join("");

    // SVD
    const trainable = rows.filter((r) => r.p.role !== "negative control");
    const { M, cols } = K.pairFeatureMatrix(trainable.map((r) => r.poem));
    const sv = K.singularValues(M);
    const er = K.effectiveRank(sv);
    const distinct = new Set(trainable.map((r) => JSON.stringify(K.letterPattern(r.poem)))).size;
    $("sv-chart").innerHTML = barChart(sv.map((v, i) => ({ label: `σ${i + 1}`, value: v })), { color: "#8a5a12", yLabel: "singular value" });
    $("sv-text").innerHTML = `ชุดเทรนที่เป็นไปได้ ${trainable.length} บท (ไม่รวม negative control) · คู่ตำแหน่งที่ใช้เป็นลักษณะ ${cols.length} คู่ · ลายไม่ซ้ำกัน ${distinct} แบบ · <b>erank ≈ ${er.toFixed(1)}</b> ` +
      `(${er > 0.7 * trainable.length ? "ลายหลากหลายสูงเมื่อเทียบกับจำนวนบท — ข้อมูลต่อชนิดยังน้อย" : "มีลายที่ซ้ำกันหลายบท — ชนิดเดียวกันจับกลุ่มได้"}) · ตีความเชิงชี้นำเท่านั้น (§11)`;

    // distance histogram
    const dk = trainable.flatMap((r) => distanceKinds(r.poem));
    const maxD = dk.length ? Math.max(...dk.map((x) => x.d)) : 0;
    const buckets = [];
    for (let d = 1; d <= maxD; d++) {
      const same = dk.filter((x) => x.d === d && x.kind === "SAME").length;
      const cross = dk.filter((x) => x.d === d && x.kind === "CROSS").length;
      if (same || cross) buckets.push({ label: String(d), same, cross });
    }
    $("dist-chart").innerHTML = stackedChart(buckets);
    const far = dk.filter((x) => x.d >= 8).length;
    $("dist-text").innerHTML = dk.length
      ? `คำซ้ำทั้งหมด ${dk.length} จุด · ระยะ Δ ≤ 2: ${dk.filter((x) => x.d <= 2).length} จุด · Δ ≥ 8: ${far} จุด (${pct(far / dk.length)}) · ลายระยะไกลเรียนยากกว่าระยะใกล้ (GPoeT, 2023)`
      : "ไม่มีคำซ้ำ";

    // lead + recommendations
    const crossShare = dk.length ? dk.filter((x) => x.kind === "CROSS").length / dk.length : 0;
    $("lora-lead").innerHTML = `ชุดทดสอบ ${tests.length} บท จาก ${new Set(tests.map((p) => p.type).filter(isRealType)).size} ชนิด · ` +
      `คำซ้ำข้ามบาท ${pct(crossShare)} · erank ≈ ${er.toFixed(1)} · ` +
      `สมมติฐานที่ควรทดสอบ: ลาย SAME ระยะใกล้ (เช่น ไม้ยมก) พบบ่อยในภาษาไทยทั่วไป จึงน่าจะเรียนง่าย ส่วนที่ LoRA ต้องเรียนจริงคือ<b>ลาย CROSS ระยะไกล</b>และ<b>กฎเฉพาะตำแหน่ง</b>`;
    const recs = [];
    const singles = typeRows.filter((r) => r.n === 1).map((r) => r.t);
    if (singles.length) recs.push(`เพิ่มบทให้ชนิดที่มีบทเดียว (${singles.join(", ")}) อย่างน้อย 2–3 บทต่อชนิด เพื่อให้กฎร่วม (meet) ตัดคำซ้ำบังเอิญออก มิฉะนั้น LoRA อาจเรียนคำซ้ำบังเอิญเป็นกฎ`);
    const counts = typeRows.map((r) => r.n);
    if (counts.length > 1 && Math.max(...counts) / Math.min(...counts) >= 2)
      recs.push(`ชุดข้อมูลไม่สมดุล (มากสุด ${Math.max(...counts)} : น้อยสุด ${Math.min(...counts)} บทต่อชนิด) — ใช้ sampling weight ∝ 1/n<sub>ชนิด</sub> หรือเพิ่มบทให้ชนิดที่น้อย`);
    const variable = typeRows.filter((r) => r.cls === "info").map((r) => r.t);
    if (variable.length) recs.push(`ชนิด ${variable.join(", ")} มีตำแหน่งแปรผัน — ใน prompt ให้บรรยายกฎแบบสัมพัทธ์ (เช่น “มีคำซ้ำติดกัน 1 คู่ในทุกบาท”) และตรวจผลด้วย prev-encoding แทนพิกัดตายตัว`);
    if (dk.length && far / dk.length >= 0.25) recs.push(`ลายระยะไกล (Δ ≥ 8) มี ${pct(far / dk.length)} — พิจารณา loss ถ่วงน้ำหนัก w<sub>t</sub> = 1 + λ ที่ตำแหน่งเป้าของกฎ (§10) และรายงานผลแยกตาม Δ`);
    const failing = rows.filter((r) => r.m.typeScore !== null && r.m.typeScore < 1 && r.typeCount > 1).map((r) => r.p.name);
    if (failing.length) recs.push(`บทที่ไม่ผ่านกฎร่วมของชนิดตัวเอง: ${failing.join(", ")} — ตรวจการแบ่งหน่วยและการสะกด (เช่น น่า/หน้า, ขวั้น/ขวัญ) ก่อนเทรน`);
    if (rows.some((r) => r.p.role === "negative control" && r.p.test)) recs.push("แยก negative control ออกจากชุดเทรน — ใช้เฉพาะตอนประเมินว่าตัวตรวจ/โมเดลไม่ได้ผ่านทุกอย่าง");
    recs.push("ก่อนเทรน LoRA ให้วัด baseline แบบใส่กฎใน prompt อย่างเดียวด้วยคะแนนผ่านกฎ + control ทั้งสามแบบ แล้วเทียบหลังเทรน เพื่อรู้ว่า LoRA เพิ่มค่าเท่าใด");
    recs.push("รายงานผลแยก SAME/CROSS และตามระยะ Δ — ค่าเฉลี่ยรวมอาจซ่อนการล้มเหลวของลายระยะไกล");
    $("lora-recs").innerHTML = recs.map((r) => `<li>${r}</li>`).join("");
  }

  function barChart(items, { color, yLabel }) {
    if (!items.length) return `<p class="empty">ไม่มีข้อมูล</p>`;
    const W = 520, H = 220, L = 44, B = 30, T = 12;
    const max = Math.max(...items.map((i) => i.value)) || 1;
    const bw = (W - L - 10) / items.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(yLabel)}" font-family="Sarabun, sans-serif">`;
    for (let g = 0; g <= 4; g++) {
      const y = T + (H - T - B) * (1 - g / 4);
      s += `<line x1="${L}" x2="${W - 6}" y1="${y}" y2="${y}" stroke="#ece8df"/><text x="${L - 6}" y="${y + 4}" font-size="11" text-anchor="end" fill="#777">${((max * g) / 4).toFixed(1)}</text>`;
    }
    items.forEach((it, i) => {
      const h = ((H - T - B) * it.value) / max;
      const x = L + i * bw + bw * 0.15;
      s += `<rect x="${x}" y="${H - B - h}" width="${bw * 0.7}" height="${h}" fill="${color}" rx="2"><title>${esc(it.label)}: ${it.value.toFixed(2)}</title></rect>`;
      if (items.length <= 16 || i % 2 === 0) s += `<text x="${x + bw * 0.35}" y="${H - B + 14}" font-size="10" text-anchor="middle" fill="#555">${esc(it.label)}</text>`;
    });
    return s + "</svg>";
  }

  function stackedChart(buckets) {
    if (!buckets.length) return `<p class="empty">ไม่มีคำซ้ำ</p>`;
    const W = 520, H = 220, L = 34, B = 34, T = 22;
    const max = Math.max(...buckets.map((b) => b.same + b.cross)) || 1;
    const bw = (W - L - 10) / buckets.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="copy distance histogram" font-family="Sarabun, sans-serif">`;
    s += `<rect x="${W - 170}" y="4" width="10" height="10" fill="#2f5fa7"/><text x="${W - 155}" y="13" font-size="11" fill="#444">SAME (ในบาท)</text>`;
    s += `<rect x="${W - 80}" y="4" width="10" height="10" fill="#c58b1a"/><text x="${W - 65}" y="13" font-size="11" fill="#444">CROSS</text>`;
    for (let g = 0; g <= 2; g++) {
      const y = T + (H - T - B) * (1 - g / 2);
      s += `<line x1="${L}" x2="${W - 6}" y1="${y}" y2="${y}" stroke="#ece8df"/><text x="${L - 6}" y="${y + 4}" font-size="11" text-anchor="end" fill="#777">${Math.round((max * g) / 2)}</text>`;
    }
    buckets.forEach((b, i) => {
      const x = L + i * bw + bw * 0.15, w = bw * 0.7;
      const hs = ((H - T - B) * b.same) / max, hc = ((H - T - B) * b.cross) / max;
      s += `<rect x="${x}" y="${H - B - hs}" width="${w}" height="${hs}" fill="#2f5fa7"><title>Δ=${b.label} SAME ${b.same}</title></rect>`;
      s += `<rect x="${x}" y="${H - B - hs - hc}" width="${w}" height="${hc}" fill="#c58b1a"><title>Δ=${b.label} CROSS ${b.cross}</title></rect>`;
      s += `<text x="${x + w / 2}" y="${H - B + 14}" font-size="10" text-anchor="middle" fill="#555">${esc(b.label)}</text>`;
    });
    s += `<text x="${(W + L) / 2}" y="${H - 4}" font-size="11" text-anchor="middle" fill="#777">ระยะคัดลอก Δ (หน่วย)</text>`;
    return s + "</svg>";
  }

  // ---------- Sources ----------
  function renderSources() {
    $("sources-table").querySelector("tbody").innerHTML = SAMPLES.filter((s) => s.role === "classical" || s.role === "ต้นฉบับ")
      .map((s) => `<tr><td><b>${esc(s.type)}</b></td><td>${esc(s.name)}</td><td>${esc(s.rule)}</td><td>${linkify(s.source)}</td><td class="muted">${esc(s.note || "")}</td></tr>`).join("");
    $("excluded-table").querySelector("tbody").innerHTML = EXCLUDED.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.reason)}</td></tr>`).join("");
  }

  // ---------- Security audit ----------
  async function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return "(เบราว์เซอร์ไม่รองรับ crypto.subtle)";
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function runAudit() {
    const train = state.poems.filter((p) => p.role !== "negative control" && parsed(p).length);
    const canonical = JSON.stringify(train.map((p) => ({ name: p.name, type: p.type || "", text: p.text })));
    const hash = await sha256(canonical);
    // admission gate: leave-one-out ภายในชนิด
    const groups = typeGroups();
    const gate = [];
    for (const [t, ps] of groups) {
      for (const p of ps) {
        if (ps.length < 2) { gate.push({ p, t, status: "ตรวจไม่ได้ (ชนิดนี้มีบทเดียว)", cls: "info" }); continue; }
        const others = ps.filter((q) => q !== p).map(parsed);
        const rules = K.intersectRules(others);
        const res = K.check(parsed(p), rules);
        gate.push({ p, t, status: rules.length ? `${res.passed}/${res.total} กฎของบทอื่นในชนิด` : "บทอื่นไม่มีกฎร่วม", cls: res.score === 1 ? "ok" : "warn" });
      }
    }
    // พยางค์ที่โผล่ข้ามหลายชนิด
    const byTok = new Map();
    for (const [t, ps] of groups) for (const p of ps) for (const x of K.flattenWithPos(parsed(p))) {
      if (!byTok.has(x.token)) byTok.set(x.token, new Set());
      byTok.get(x.token).add(t);
    }
    const nTypes = groups.size;
    const thr = Math.max(3, Math.ceil(nTypes * 0.3));
    const spread = [...byTok.entries()].filter(([, s]) => s.size >= thr).sort((a, b) => b[1].size - a[1].size);
    $("audit-out").innerHTML = `
      <h3>1) SHA-256 ของชุดข้อมูล (${train.length} บท, ไม่รวม negative control)</h3>
      <code class="hash">${esc(hash)}</code>
      <p class="muted small">บันทึกค่านี้คู่กับ checkpoint ของ LoRA — ถ้าข้อมูลถูกแก้แม้ 1 ตัวอักษร ค่าจะเปลี่ยนทั้งหมด</p>
      <h3>2) ด่านรับข้อมูล (leave-one-out ภายในชนิด)</h3>
      <table class="results"><thead><tr><th>กลอน</th><th>ชนิด</th><th>ผล</th></tr></thead><tbody>
      ${gate.map((g) => `<tr><td>${esc(g.p.name)}</td><td>${esc(g.t)}</td><td><div class="ltag ${g.cls}">${esc(g.status)}</div></td></tr>`).join("")}
      </tbody></table>
      <h3>3) พยางค์ที่ปรากฏใน ≥ ${thr} ชนิด (จาก ${nTypes} ชนิด)</h3>
      ${spread.length ? `<p>${spread.map(([tok, s]) => `<code>${esc(tok)}</code> <span class="muted">(${s.size})</span>`).join(" · ")}</p>
        <p class="muted small">ส่วนใหญ่เป็นคำทั่วไป แต่ถ้าพบคำแปลกที่โผล่ในหลายชนิดผิดธรรมชาติ ให้ตรวจที่มา — เป็นลักษณะเดียวกับ trigger ของ data poisoning</p>`
        : `<p class="good">ไม่พบพยางค์ที่กระจายข้ามชนิดผิดปกติ</p>`}`;
  }
  $("btn-audit").addEventListener("click", runAudit);

  // ---------- events ----------
  $("poem-name").addEventListener("input", (e) => { selected().name = e.target.value; render(); });
  $("poem-type").addEventListener("input", (e) => { selected().type = e.target.value.trim(); render(); });
  $("poem-text").addEventListener("input", (e) => { selected().text = e.target.value; render(); });
  $("vocab-size").addEventListener("input", (e) => { state.vocab = Number(e.target.value) || 3000; renderLora(); save(); });

  $("btn-new").addEventListener("click", () => {
    const p = { id: uid(), name: `กลอนใหม่ ${state.poems.length + 1}`, type: "", text: "", ref: false, test: true, role: "ผู้ใช้เพิ่ม" };
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
    p.text = p.text.split("\n").map((line) => line.split("|").map((wak) =>
      [...seg.segment(wak.replace(/\s+/g, ""))].filter((x) => x.isWordLike).map((x) => x.segment).join(" ")).join(" | ")).join("\n");
    render();
    alertInline("ตัดคำแล้ว — ตัวตัดคำแบ่งเป็น “คำ” ไม่ใช่ “พยางค์” กรุณาตรวจและเว้นวรรคเพิ่มเอง");
  });
  $("btn-export").addEventListener("click", () => {
    const data = { app: "kloang-pattern-lab", version: 2, exported: new Date().toISOString(),
      poems: state.poems.map(({ name, type, text, ref, test, source, rule, note, role }) => ({ name, type, text, ref, test, source, rule, note, role })) };
    download("kloang-poems.json", JSON.stringify(data, null, 2), "application/json");
  });
  $("file-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.poems;
      if (!Array.isArray(list)) throw new Error("no poems");
      const added = list.filter((x) => typeof x.text === "string").map((x) => ({
        id: uid(), name: String(x.name || "นำเข้า"), type: String(x.type || ""), text: x.text, ref: !!x.ref, test: x.test !== false,
        source: x.source ? String(x.source) : "", rule: x.rule ? String(x.rule) : "", note: x.note ? String(x.note) : "", role: x.role ? String(x.role) : "นำเข้า",
      }));
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
    const trm = typeRuleMap();
    const rows = [["name", "type", "shape", "passed", "total", "score", "N", "own_rules", "same", "cross", "density", "mean_dist", "max_dist", "noise_ratio", "type_score", "failed_rules"]];
    for (const p of state.poems.filter((x) => x.test)) {
      const poem = parsed(p);
      const res = K.check(poem, rules.active);
      const m = K.loraMetrics(poem, isRealType(p.type) ? trm.get(p.type) || [] : [], state.vocab);
      rows.push([p.name, p.type || "", K.shape(poem), res.passed, res.total, res.score.toFixed(4), m.N, m.ownRules, m.same, m.cross,
        m.density.toFixed(4), m.meanDist.toFixed(3), m.maxDist, m.noiseRatio === null ? "" : m.noiseRatio.toFixed(4), m.typeScore === null ? "" : m.typeScore.toFixed(4),
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
    const note = document.createElement("div");
    note.className = "warn";
    note.textContent = msg;
    $("poem-meta").appendChild(note);
    setTimeout(() => note.remove(), 5000);
  }

  // ---------- init ----------
  $("vocab-size").value = state.vocab || 3000;
  renderSources();
  render();
  const initial = (location.hash || "").replace("#", "");
  showTab(["purpose", "lab", "lora", "math", "security", "sources"].includes(initial) ? initial : "purpose");
  window.addEventListener("load", () => { if ($("tab-math").classList.contains("active")) renderMath(); });
})();
