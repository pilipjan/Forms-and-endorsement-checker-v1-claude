(function () {
  /* ── SAMPLES ─────────────────────────────────────────── */
  const samples = {
    previous: [
      "CG20100413 ADDITIONAL INSURED - OWNERS, LESSEES OR CONTRACTORS",
      "CG 20 37 (04/13) ADDITIONAL INSURED - OWNERS, LESSEES OR CONTRACTORS - COMPLETED OPERATIONS",
      "IL00171198 COMMON POLICY CONDITIONS",
      "CA 00 01 10/13 BUSINESS AUTO COVERAGE FORM",
      "CP00100695 BUILDING AND PERSONAL PROPERTY COVERAGE FORM",
      "WEIRD OCR LINE WITHOUT A FORM NUMBER",
    ].join("\n"),
    current: [
      "CG 20 10 (12/19) ADDITIONAL INSURED - OWNERS, LESSEES OR CONTRACTORS",
      "CG 20 37 (04/13) ADDITIONAL INSURED - OWNERS, LESSEES OR CONTRACTORS - COMPLETED OPERATIONS",
      "IL 00 17 (11/98) COMMON POLICY CONDITIONS",
      "CA00011013 BUSINESS AUTO COVERAGE FORM",
      "BP 00 03 07/13 BUSINESSOWNERS COVERAGE FORM",
      "OCR? CP FORM BADLY SCANNED",
    ].join("\n"),
    quote: [
      "CG 20 10 (12/19) ADDITIONAL INSURED - OWNERS, LESSEES OR CONTRACTORS",
      "CG 20 37 (04/13) ADDITIONAL INSURED - OWNERS, LESSEES OR CONTRACTORS - COMPLETED OPERATIONS",
      "BP 00 03 07/13 BUSINESSOWNERS COVERAGE FORM",
    ].join("\n"),
  };

  /* ── STATE ────────────────────────────────────────────── */
  const state = {
    prefixes: window.ComparatorParser.defaultPrefixes.slice(),
    previousItems: [], currentItems: [], quoteItems: [], fourthItems: [],
    results: [], checklistRows: [],
    collapsedGroups: new Set(),
    // v2.0
    filters: { Match: true, Added: true, Removed: true, "Edition Changed": true, "Description Changed": true, "Possible Typo": true, "Unknown Format": true, "Manually Linked": true },
    statusLabels: {},         // status -> custom display label; empty = use defaults
    searchQuery: "",
    diffsOnly: false,
    sideBySide: false,
    pinnedCodes: new Set(),
    rowNotes: new Map(),       // normalizedCode -> string
    customEdits: new Map(),    // normalizedCode -> { displayCode?, description? }
    undoSnapshot: null,
    linkPending: null,         // _id of the first row picked for manual re-pair, or null
  };

  const draftKey = "formsComparatorDraftV1";
  let draftTimer = null;
  let noteTarget = null;

  /* ── ELEMENT REFS ─────────────────────────────────────── */
  const el = {
    previousInput:      document.getElementById("previousInput"),
    currentInput:       document.getElementById("currentInput"),
    quoteInput:         document.getElementById("quoteInput"),
    fourthInput:        document.getElementById("fourthInput"),
    previousPreview:    document.getElementById("previousPreview"),
    currentPreview:     document.getElementById("currentPreview"),
    quotePreview:       document.getElementById("quotePreview"),
    fourthPreview:      document.getElementById("fourthPreview"),
    resultsBody:        document.getElementById("resultsBody"),
    sbsBody:            document.getElementById("sbsBody"),
    excelChecklistBody: document.getElementById("excelChecklistBody"),
    resultViewSelect:   document.getElementById("resultViewSelect"),
    prefixInput:        document.getElementById("prefixInput"),
    lastCompared:       document.getElementById("lastCompared"),
    comparisonTime:     document.getElementById("comparisonTime"),
    pieChart:           document.getElementById("pieChart"),
    barChart:           document.getElementById("barChart"),
    offlineStatus:      document.getElementById("offlineStatus"),
    themeToggleBtn:     document.getElementById("themeToggleBtn"),
    memoryStatus:       document.getElementById("memoryStatus"),
    resultsTableWrap:   document.getElementById("resultsTableWrap"),
    sbsWrap:            document.getElementById("sbsWrap"),
    resultsSearch:      document.getElementById("resultsSearch"),
    diffsOnlyBtn:       document.getElementById("diffsOnlyBtn"),
    sideBySideBtn:      document.getElementById("sideBySideBtn"),
    undoToast:          document.getElementById("undoToast"),
    smartExportModal:   document.getElementById("smartExportModal"),
    noteDialog:         document.getElementById("noteDialog"),
    noteCodeBadge:      document.getElementById("noteCodeBadge"),
    noteTextarea:       document.getElementById("noteTextarea"),
    exportScopeNote:    document.getElementById("exportScopeNote"),
  };

  const metricIds = {
    Previous: "metricPrevious", Current: "metricCurrent",
    Match: "metricMatch", Added: "metricAdded", Removed: "metricRemoved",
    "Edition Changed": "metricChanged", "Description Changed": "metricDescChanged",
    "Possible Typo": "metricTypo", "Unknown Format": "metricUnknown",
    Completion: "metricCompletion",
  };

  /* ── UTILS ────────────────────────────────────────────── */
  function statusClass(status) {
    return `status-${status.toLowerCase().replace(/\s+/g, "-")}`;
  }

  function esc(v) {
    return String(v || "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  /* ── RESULT DISPLAY SETTINGS (labels + visibility) ────────
     One place to customize what each status is called and whether it's
     shown at all — applies everywhere a status appears: results table,
     side-by-side, filter chips, metric cards, charts, and CSV/Excel/TSV
     exports. Some teams use different wording ("Deleted" instead of
     "Removed", etc.) — this lets the tool's output match without touching
     the underlying matching logic, which still uses the original names. */
  const RESULT_SETTINGS_KEY = "formsComparatorResultSettingsV1";
  const STATUS_META = [
    { key: "Match",               chipId: "chipMatch",       cntId: "cntMatch",       labelId: "chipLabelMatch",       metricLabelId: null,                  dotVar: "--s-match" },
    { key: "Added",                chipId: "chipAdded",       cntId: "cntAdded",       labelId: "chipLabelAdded",       metricLabelId: "metricLabelAdded",    dotVar: "--s-added" },
    { key: "Removed",              chipId: "chipRemoved",     cntId: "cntRemoved",     labelId: "chipLabelRemoved",     metricLabelId: "metricLabelRemoved",  dotVar: "--s-removed" },
    { key: "Edition Changed",      chipId: "chipChanged",     cntId: "cntChanged",     labelId: "chipLabelChanged",     metricLabelId: "metricLabelChanged",  dotVar: "--s-changed" },
    { key: "Description Changed",  chipId: "chipDescChanged", cntId: "cntDescChanged", labelId: "chipLabelDescChanged", metricLabelId: "metricLabelDescChanged", dotVar: "--s-desc-changed" },
    { key: "Possible Typo",        chipId: "chipTypo",        cntId: "cntTypo",        labelId: "chipLabelTypo",        metricLabelId: "metricLabelTypo",     dotVar: "--s-typo" },
    { key: "Unknown Format",       chipId: "chipUnknown",     cntId: "cntUnknown",     labelId: "chipLabelUnknown",     metricLabelId: "metricLabelUnknown",  dotVar: "--s-unknown" },
    { key: "Manually Linked",      chipId: "chipManual",      cntId: "cntManual",      labelId: "chipLabelManual",      metricLabelId: null,                  dotVar: "--s-manual" },
  ];
  // Your coworkers' terminology — Removed/Unknown Format renamed; everything
  // else keeps its default wording. Edit the values here (or just use the
  // text boxes in Settings) if this guess doesn't match their sheet exactly.
  const COWORKER_PRESET = { Removed: "Deleted", "Unknown Format": "Not Present" };

  function displayLabel(status) {
    return (state.statusLabels && state.statusLabels[status]) || status;
  }

  function loadResultSettings() {
    try {
      const raw = localStorage.getItem(RESULT_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.labels) state.statusLabels = parsed.labels;
      if (parsed.filters) Object.assign(state.filters, parsed.filters);
    } catch { /* ignore corrupt/unavailable storage, defaults stand */ }
  }

  function saveResultSettings() {
    try {
      localStorage.setItem(RESULT_SETTINGS_KEY, JSON.stringify({ labels: state.statusLabels, filters: state.filters }));
    } catch { /* storage full/unavailable — setting just won't persist this session */ }
  }

  // Pushes current labels/visibility into every static bit of UI (chips,
  // metric cards, settings panel) and re-renders everything that displays
  // a status. Call after any label or visibility change.
  function applyResultSettings() {
    STATUS_META.forEach(m => {
      const label = displayLabel(m.key);
      const labelEl = document.getElementById(m.labelId);
      if (labelEl) labelEl.textContent = label;
      if (m.metricLabelId) {
        const metricEl = document.getElementById(m.metricLabelId);
        if (metricEl) metricEl.textContent = label;
      }
      const chipEl = document.getElementById(m.chipId);
      if (chipEl) chipEl.classList.toggle("off", state.filters[m.key] === false);
    });
    renderResultSettingsRows();
    saveResultSettings();
    if (state.results.length) {
      renderResults();
      if (!el.sbsWrap.classList.contains("hidden")) renderSBS();
      drawCharts(summarize(state.results));
      updateFilterCounts();
    }
  }

  function renderResultSettingsRows() {
    const wrap = document.getElementById("resultSettingsRows");
    if (!wrap) return;
    wrap.innerHTML = STATUS_META.map(m => `
      <div class="result-settings-row">
        <input type="checkbox" id="rsVis_${m.chipId}" ${state.filters[m.key] !== false ? "checked" : ""} data-rs-vis="${esc(m.key)}" title="Show/hide this status" />
        <span class="rs-dot" style="background:var(${m.dotVar})"></span>
        <span class="rs-default">${esc(m.key)}</span>
        <input type="text" data-rs-label="${esc(m.key)}" value="${esc(displayLabel(m.key))}" placeholder="${esc(m.key)}" />
      </div>`).join("");
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const safe = esc(text);
    const safeQ = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!safeQ) return safe;
    return safe.replace(new RegExp(`(${safeQ})`, "gi"), '<make class="hl">$1</make>').replace(/<make/g, "<mark").replace(/\/make>/g, "/mark>");
  }

  function diffHighlight(prevText, currText, q) {
    if (!prevText || !currText) {
      return {
        prev: highlight(prevText || "", q),
        curr: highlight(currText || "", q)
      };
    }

    const tokensA = prevText.split(/(\s+)/);
    const tokensB = currText.split(/(\s+)/);

    const wordsA = [];
    const wordsB = [];

    tokensA.forEach((tok, idx) => {
      if (/\S/.test(tok)) wordsA.push({ text: tok, idx });
    });
    tokensB.forEach((tok, idx) => {
      if (/\S/.test(tok)) wordsB.push({ text: tok, idx });
    });

    const dp = Array(wordsA.length + 1).fill(null).map(() => Array(wordsB.length + 1).fill(0));
    for (let i = 1; i <= wordsA.length; i++) {
      for (let j = 1; j <= wordsB.length; j++) {
        if (wordsA[i - 1].text.toUpperCase() === wordsB[j - 1].text.toUpperCase()) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = wordsA.length, j = wordsB.length;
    const matchA = new Set();
    const matchB = new Set();
    while (i > 0 && j > 0) {
      if (wordsA[i - 1].text.toUpperCase() === wordsB[j - 1].text.toUpperCase()) {
        matchA.add(wordsA[i - 1].idx);
        matchB.add(wordsB[j - 1].idx);
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    const resA = tokensA.map((tok, idx) => {
      if (!/\S/.test(tok)) return esc(tok);
      const isMatched = matchA.has(idx);
      const formatted = highlight(tok, q);
      return isMatched ? formatted : `<span class="diff-removed-inline">${formatted}</span>`;
    }).join("");

    const resB = tokensB.map((tok, idx) => {
      if (!/\S/.test(tok)) return esc(tok);
      const isMatched = matchB.has(idx);
      const formatted = highlight(tok, q);
      return isMatched ? formatted : `<span class="diff-added-inline">${formatted}</span>`;
    }).join("");

    return { prev: resA, curr: resB };
  }

  function flashBtn(id, done, orig) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = done;
    window.setTimeout(() => { btn.textContent = orig; }, 1600);
  }

  /* ── FILTER LOGIC ─────────────────────────────────────── */
  function baseRows() {
    const src = el.resultViewSelect.value;
    return src === "all" ? state.results : state.results.filter(r => (r.source || "Current Policy") === src);
  }

  function getFiltered() {
    let rows = baseRows();
    if (state.diffsOnly) rows = rows.filter(r => r.status !== "Match");
    rows = rows.filter(r => state.filters[r.status] !== false);
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      rows = rows.filter(r =>
        (r.normalizedCode || "").toLowerCase().includes(q) ||
        (r.displayCode || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.originalPrevious || "").toLowerCase().includes(q) ||
        (r.originalCurrent || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q) ||
        (state.rowNotes.get(r.normalizedCode) || "").toLowerCase().includes(q)
      );
    }
    const pinned = rows.filter(r => state.pinnedCodes.has(r.normalizedCode));
    const rest   = rows.filter(r => !state.pinnedCodes.has(r.normalizedCode));
    return [...pinned, ...rest];
  }

  function updateFilterCounts() {
    const rows = baseRows();
    const c = { Match: 0, Added: 0, Removed: 0, "Edition Changed": 0, "Description Changed": 0, "Possible Typo": 0, "Unknown Format": 0, "Manually Linked": 0 };
    rows.forEach(r => { if (c[r.status] !== undefined) c[r.status]++; });
    document.getElementById("cntMatch").textContent   = `(${c.Match})`;
    document.getElementById("cntAdded").textContent   = `(${c.Added})`;
    document.getElementById("cntRemoved").textContent = `(${c.Removed})`;
    document.getElementById("cntChanged").textContent = `(${c["Edition Changed"]})`;
    document.getElementById("cntDescChanged").textContent = `(${c["Description Changed"]})`;
    document.getElementById("cntTypo").textContent   = `(${c["Possible Typo"]})`;
    document.getElementById("cntUnknown").textContent = `(${c["Unknown Format"]})`;
    document.getElementById("cntManual").textContent = `(${c["Manually Linked"]})`;
    updateScopeNote();
  }

  function updateScopeNote() {
    const src = el.resultViewSelect.value;
    const label = src === "all" ? "All documents" : displaySrcName(src);
    const visible = getFiltered().length;
    const total = baseRows().length;
    el.exportScopeNote.textContent = `View: ${label} — ${visible} of ${total} rows visible.`;
  }

  /* ── RENDER PREVIEW ───────────────────────────────────── */
  function renderPreview(tbody, items) {
    tbody.innerHTML = items.length
      ? items.map(i => `<tr class="${statusClass(i.parseStatus)}"><td>${esc(i.parseStatus)}</td><td>${esc(i.displayCode)}</td><td>${esc(i.displayEdition)}</td><td>${esc(i.description)}</td></tr>`).join("")
      : `<tr><td colspan="4">No parsed rows yet.</td></tr>`;
  }

  /* ── RENDER RESULTS ───────────────────────────────────── */
  function renderResults() {
    if (state.sideBySide) { renderSBS(); return; }
    el.resultsTableWrap.classList.remove("hidden");
    el.sbsWrap.classList.add("hidden");

    const rows = getFiltered();
    updateFilterCounts();

    if (!rows.length) {
      el.resultsBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px;">No results match the current filters. Adjust filters or run a comparison.</td></tr>`;
      return;
    }

    const src = el.resultViewSelect.value;
    if (src === "all") {
      const groups = groupBySource(rows);
      el.resultsBody.innerHTML = groups.map(({ source, rows: gr }) => {
        const collapsed = state.collapsedGroups.has(source);
        const cnt = summarize(gr);
        const meta = `${gr.length} rows | ${cnt.Match||0} match | ${cnt.Added||0} added | ${cnt.Removed||0} removed | ${cnt["Edition Changed"]||0} revised | ${cnt["Unknown Format"]||0} unknown`;
        return `<tr class="result-group-row"><td colspan="9">
            <button class="result-group-button" type="button" data-group="${esc(source)}">${collapsed ? "▶" : "▼"} ${esc(displaySrcName(source))}</button>
            <span class="result-group-meta">${esc(meta)}</span>
          </td></tr>
          ${collapsed ? "" : gr.map(resultRowHtml).join("")}`;
      }).join("");
      return;
    }
    el.resultsBody.innerHTML = rows.map(resultRowHtml).join("");
  }

  // Best-effort split of an unparsed raw line into a code guess + edition guess
  // + description guess, so Quick Add starts pre-filled instead of empty. This
  // is a guess — the fields stay editable so the user confirms/fixes it before saving.
  function guessCodeAndDescription(rawLine) {
    let clean = String(rawLine || "").trim().replace(/\s+/g, " ");

    // Pull out something that looks like an edition date: (04/13), 04/13, or 0413
    let edition = "";
    const editionMatch = clean.match(/\(?(\d{2}\/\d{2}|\d{4})\)?/);
    if (editionMatch) {
      edition = editionMatch[1];
      clean = (clean.slice(0, editionMatch.index) + clean.slice(editionMatch.index + editionMatch[0].length)).replace(/\s+/g, " ").trim();
    }

    // Leading run of short alphanumeric tokens (1-6 chars each, up to 4 of them)
    // looks like a form code; everything after is treated as the description.
    const m = clean.match(/^((?:[A-Z0-9]{1,6}\s+){0,3}[A-Z0-9]{1,6})\s*(.*)$/i);
    if (m && m[1]) {
      return { code: m[1].trim().toUpperCase(), edition, description: (m[2] || "").trim() };
    }
    return { code: "", edition, description: clean };
  }

  function openDataBankFromRow(rowId) {
    const item = state.results.find(r => r._id === rowId);
    if (!item) return;
    const raw = item.originalCurrent || item.originalPrevious || item.displayCode || "";
    const guess = guessCodeAndDescription(raw);
    document.getElementById("dbAddCode").value = guess.code;
    document.getElementById("dbAddDesc").value = guess.description;
    document.getElementById("dbAddEdition").value = guess.edition;
    renderDataBankTable();
    document.getElementById("dataBankModal").showModal();
    const codeInput = document.getElementById("dbAddCode");
    codeInput.focus(); codeInput.select();
  }

  // Statuses where a row might be the "other half" of a form the auto-matcher missed
  // or mismatched — these are the only ones eligible for manual re-pairing.
  const LINKABLE_STATUSES = new Set(["Added", "Removed", "Unknown Format"]);

  function linkButtonHtml(item) {
    if (!LINKABLE_STATUSES.has(item.status)) return "";
    const isPending = state.linkPending === item._id;
    const title = isPending
      ? "Click another Added/Removed/Unknown row to link them together"
      : "Mark as the same form as another row (fixes a missed or wrong auto-match)";
    return `<button class="link-btn${isPending ? " on" : ""}" type="button" data-link="${esc(item._id)}" title="${esc(title)}">${isPending ? "🔗" : "⛓"}</button>`;
  }

  function duplicateBadgeHtml(item) {
    if (!item.duplicateCount) return "";
    const lines = (item.duplicateLines || []).map(esc).join(" | ");
    return `<span class="dup-badge" title="Repeated on the schedule but collapsed into this row: ${lines}">⚠ ×${item.duplicateCount + 1}</span>`;
  }

  function confidenceBadgeHtml(item) {
    if (item.confidence === null || item.confidence === undefined) return "";
    const pct = Math.round(item.confidence * 100);
    return `<span class="conf-badge" title="Description similarity score">${pct}%</span>`;
  }

  function addToDataBankButtonHtml(item) {
    if (item.status !== "Unknown Format" || !item._id) return "";
    return `<button class="db-add-btn" type="button" data-db-add="${esc(item._id)}" title="This is actually a real form — add it to the Data Bank">➕🗄</button>`;
  }

  function resultRowHtml(item) {
    const code    = item.normalizedCode || "";
    const pinned  = state.pinnedCodes.has(code);
    const hasNote = state.rowNotes.has(code) && state.rowNotes.get(code).trim();
    const edit    = state.customEdits.get(code) || {};
    const dispCode = edit.displayCode !== undefined ? edit.displayCode : (item.displayCode || item.normalizedCode);
    const desc     = edit.description !== undefined ? edit.description : item.description;
    const q = state.searchQuery;
    const diffs = diffHighlight(item.originalPrevious, item.originalCurrent, q);
    const rowClasses = [statusClass(item.status), pinned ? "row-pinned" : "", item.manual ? "row-manual" : ""].filter(Boolean).join(" ");
    return `<tr class="${rowClasses}" data-code="${esc(code)}"${item._id ? ` data-id="${esc(item._id)}"` : ""}>
      <td>${esc(displayLabel(item.status))} ${duplicateBadgeHtml(item)}${confidenceBadgeHtml(item)}</td>
      <td>${esc(item.source || "Current Policy")}</td>
      <td><span contenteditable="true" data-field="displayCode" data-code="${esc(code)}">${highlight(dispCode, q)}</span></td>
      <td>${diffs.prev}</td>
      <td>${diffs.curr}</td>
      <td><span contenteditable="true" data-field="description" data-code="${esc(code)}">${highlight(desc, q)}</span></td>
      <td>${esc(item.edition)}</td>
      <td>${esc(item.notes)}</td>
      <td class="row-actions-td">
        ${linkButtonHtml(item)}
        ${addToDataBankButtonHtml(item)}
        <button class="pin-btn${pinned ? " on" : ""}" type="button" data-pin="${esc(code)}" title="${pinned ? "Unpin" : "Pin to top"}">${pinned ? "⭐" : "☆"}</button>
        <button class="note-btn${hasNote ? " on" : ""}" type="button" data-note="${esc(code)}" title="${hasNote ? "Edit note" : "Add note"}">${hasNote ? "📝" : "🖊"}</button>
      </td>
    </tr>`;
  }

  /* ── SIDE-BY-SIDE ─────────────────────────────────────── */
  function renderSBS() {
    el.resultsTableWrap.classList.add("hidden");
    el.sbsWrap.classList.remove("hidden");
    const rows = getFiltered();
    updateFilterCounts();
    if (!rows.length) {
      el.sbsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px;">No results. Run a comparison first.</td></tr>`;
      return;
    }
    el.sbsBody.innerHTML = rows.map(item => {
      const code = item.normalizedCode || "";
      const pinned = state.pinnedCodes.has(code);
      const hasNote = state.rowNotes.has(code) && state.rowNotes.get(code).trim();
      let prev = "", curr = "";
      switch (item.status) {
        case "Match":
          prev = esc(item.originalPrevious || item.displayCode);
          curr = esc(item.originalCurrent  || item.displayCode);
          break;
        case "Removed":
          prev = `<span class="sbs-removed">${esc(item.originalPrevious || item.displayCode)}</span>`;
          curr = `<span class="sbs-empty">— not present —</span>`;
          break;
        case "Added":
          prev = `<span class="sbs-empty">— not present —</span>`;
          curr = `<span class="sbs-added">${esc(item.originalCurrent || item.displayCode)}</span>`;
          break;
        case "Edition Changed":
        case "Description Changed":
        case "Possible Typo":
          const sbsDiff = diffHighlight(item.originalPrevious, item.originalCurrent, "");
          prev = `<span class="sbs-changed">${sbsDiff.prev}</span>`;
          curr = `<span class="sbs-changed">${sbsDiff.curr}</span>`;
          break;
        default:
          prev = esc(item.originalPrevious || item.displayCode);
          curr = esc(item.originalCurrent  || item.displayCode);
      }
      return `<tr class="${statusClass(item.status)}${pinned ? " row-pinned" : ""}" data-code="${esc(code)}">
        <td>${esc(displayLabel(item.status))}</td>
        <td class="sbs-code">${esc(item.displayCode || item.normalizedCode || "")}</td>
        <td class="sbs-col-prev">${prev}</td>
        <td class="sbs-col-curr">${curr}</td>
        <td class="sbs-edition">${esc(item.edition || "")}</td>
        <td class="row-actions-td">
          <button class="pin-btn${pinned ? " on" : ""}" type="button" data-pin="${esc(code)}">${pinned ? "⭐" : "☆"}</button>
          <button class="note-btn${hasNote ? " on" : ""}" type="button" data-note="${esc(code)}">${hasNote ? "📝" : "🖊"}</button>
        </td>
      </tr>`;
    }).join("");
  }

  /* ── GROUP HELPERS ────────────────────────────────────── */
  function groupBySource(rows) {
    const order = ["Current Policy", "Quote / 3rd Document", "4th Document"];
    return order
      .map(src => ({ source: src, rows: rows.filter(r => (r.source || "Current Policy") === src) }))
      .filter(g => g.rows.length);
  }

  function displaySrcName(src) {
    return src === "Quote / 3rd Document" ? "3rd Document" : src;
  }

  /* ── CHECKLIST ────────────────────────────────────────── */
  function checklistStatus(s) { return s === "Edition Changed" ? "Revised" : s; }

  function formDescription(row) {
    const edit = state.customEdits.get(row.normalizedCode) || {};
    // When toggled to "previous", use originalPrevious if available
    let rawCode;
    if (typeof checklistView !== "undefined" && checklistView === "previous" && row.originalPrevious) {
      rawCode = row.originalPrevious;
    } else {
      rawCode = edit.displayCode !== undefined ? edit.displayCode : (row.displayCode || row.normalizedCode || "");
    }
    // Strip trailing edition suffix like "(10/93)" or "(09/11)" from the display code
    // so the edition appears only in its own column
    const code = rawCode.replace(/\s*\(\d{1,2}\/\d{2,4}\)\s*$/, "").trim();
    const desc = edit.description !== undefined ? edit.description : row.description;
    return [code, desc].filter(Boolean).join(" ") || row.normalizedCode || "";
  }


  function checklistEdition(v) {
    let e = String(v || "").trim();
    if (e.includes("->")) e = e.split("->").pop().trim();
    if (!e) return "";
    return e.startsWith("(") ? e : `(${e})`;
  }

  function makeChecklistRows(results) {
    return results
      .filter(r => r.status !== "Unknown Format")
      .map(r => ({
        formDescription: formDescription(r),
        edition: checklistEdition(r.edition),
        status: checklistStatus(r.status),
        source: r.source || "Current Policy",
        normalizedCode: r.normalizedCode,
        displayCode: r.displayCode || r.normalizedCode,
        originalPrevious: r.originalPrevious,
        originalCurrent: r.originalCurrent,
        description: r.description,
      }));
  }

  function renderChecklist() {
    const src = el.resultViewSelect.value;
    const rows = src === "all" ? state.checklistRows : state.checklistRows.filter(r => r.source === src);
    el.excelChecklistBody.innerHTML = rows.length
      ? rows.map(r => {
          const cv = v => esc(v || "");
          return `<tr class="${statusClass(r.status)}">
            <td class="cell-copy" data-copy-val="${cv(r.formDescription)}">${cv(r.formDescription)}</td>
            <td class="cell-copy" data-copy-val="${cv(r.edition)}">${cv(r.edition)}</td>
            <td class="cell-copy" data-copy-val="${cv(r.status)}">${cv(r.status)}</td>
            <td class="cell-copy" data-copy-val="${cv(r.source)}">${cv(r.source)}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="4">Run a comparison to generate Excel-ready rows.</td></tr>`;
  }

  /* ── METRICS ──────────────────────────────────────────── */
  function summarize(results) {
    return results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  }

  function updateMetrics(summary, meta) {
    const total = Math.max(1, state.results.length);
    const known = (summary.Match||0) + (summary.Added||0) + (summary.Removed||0) + (summary["Edition Changed"]||0) + (summary["Description Changed"]||0) + (summary["Possible Typo"]||0) + (summary["Manually Linked"]||0);
    const completion = Math.round((known / total) * 100);
    const vals = {
      Previous: meta ? meta.previousCount : state.previousItems.length,
      Current: meta ? meta.currentCount : state.currentItems.length,
      Match: summary.Match || 0,
      Added: summary.Added || 0,
      Removed: summary.Removed || 0,
      "Edition Changed": summary["Edition Changed"] || 0,
      "Description Changed": summary["Description Changed"] || 0,
      "Possible Typo": summary["Possible Typo"] || 0,
      "Unknown Format": summary["Unknown Format"] || 0,
      Completion: `${state.results.length ? completion : 0}%`,
    };
    for (const [key, id] of Object.entries(metricIds)) {
      document.getElementById(id).textContent = vals[key];
    }
  }

  /* ── PARSE HELPERS ────────────────────────────────────── */
  // Settings prefixes + everything the data bank has learned from past use,
  // deduped. This is what makes prefix recognition improve over time instead
  // of resetting to the Settings box's contents on every session.
  function effectivePrefixes() {
    const fromSettings = window.ComparatorParser.parsePrefixes(el.prefixInput.value);
    const learned = window.ComparatorDataBank ? window.ComparatorDataBank.getPrefixes() : [];
    return Array.from(new Set([...fromSettings, ...learned]));
  }

  function cleanPrevious() {
    state.prefixes = effectivePrefixes();
    state.previousItems = window.ComparatorParser.parseSchedule(el.previousInput.value, state.prefixes);
    renderPreview(el.previousPreview, state.previousItems);
    updateMetrics(summarize(state.results), null);
  }
  function cleanCurrent() {
    state.prefixes = effectivePrefixes();
    state.currentItems = window.ComparatorParser.parseSchedule(el.currentInput.value, state.prefixes);
    renderPreview(el.currentPreview, state.currentItems);
    updateMetrics(summarize(state.results), null);
  }
  function cleanQuote() {
    state.prefixes = effectivePrefixes();
    state.quoteItems = window.ComparatorParser.parseSchedule(el.quoteInput.value, state.prefixes);
    renderPreview(el.quotePreview, state.quoteItems);
  }
  function cleanFourth() {
    state.prefixes = effectivePrefixes();
    state.fourthItems = window.ComparatorParser.parseSchedule(el.fourthInput.value, state.prefixes);
    renderPreview(el.fourthPreview, state.fourthItems);
  }

  /* ── COMPARE ──────────────────────────────────────────── */
  function compareAgainst(label, items) {
    const cmp = window.ComparatorEngine.compareSchedules(state.previousItems, items);
    cmp.results.forEach(r => {
      r.source = label;
      if (label !== "Current Policy") r.notes = `${label}: ${r.notes}`;
    });
    return cmp;
  }

  function compare() {
    const t0 = performance.now();
    cleanPrevious(); cleanCurrent();
    if (!document.getElementById("quotePane").classList.contains("hidden")) cleanQuote();
    if (!document.getElementById("fourthPane").classList.contains("hidden")) cleanFourth();

    const cmps = [compareAgainst("Current Policy", state.currentItems)];
    if (state.quoteItems.length)  cmps.push(compareAgainst("Quote / 3rd Document", state.quoteItems));
    if (state.fourthItems.length) cmps.push(compareAgainst("4th Document", state.fourthItems));

    state.results = cmps.flatMap(c => c.results);
    state.results.forEach((r, i) => { r._id = `row${i}`; });
    state.linkPending = null;
    state.checklistRows = makeChecklistRows(state.results);
    const summary = summarize(state.results);

    // Learn from this run BEFORE any rendering, so a chart/render bug can
    // never prevent the data bank from picking up what was just parsed.
    if (window.ComparatorDataBank) {
      try {
        window.ComparatorDataBank.learnFromItems(state.previousItems);
        window.ComparatorDataBank.learnFromItems(state.currentItems);
        window.ComparatorDataBank.learnFromItems(state.quoteItems);
        window.ComparatorDataBank.learnFromItems(state.fourthItems);
        updateDataBankStatLine();
      } catch (err) {
        console.error("Data bank learning failed:", err);
      }
    }

    // Each render step is isolated: one failing (e.g. a canvas issue) won't
    // stop the others or roll back state.results/the data bank update above.
    try { renderResults(); } catch (err) { console.error("renderResults failed:", err); }
    try { renderChecklist(); } catch (err) { console.error("renderChecklist failed:", err); }
    try { updateMetrics(summary, cmps[0]); } catch (err) { console.error("updateMetrics failed:", err); }
    try { updateFilterCounts(); } catch (err) { console.error("updateFilterCounts failed:", err); }
    try { drawCharts(summary); } catch (err) { console.error("drawCharts failed:", err); }

    el.comparisonTime.textContent = `${((performance.now() - t0) / 1000).toFixed(2)} sec`;
    el.lastCompared.textContent = new Date().toLocaleString();
    saveDraft();
  }

  function drawCharts(summary) {
    const data = [
      [displayLabel("Match"),               summary.Match || 0,                    "#15803d"],
      [displayLabel("Added"),               summary.Added || 0,                    "#ca8a04"],
      [displayLabel("Removed"),             summary.Removed || 0,                  "#dc2626"],
      [displayLabel("Edition Changed"),     summary["Edition Changed"] || 0,       "#ea580c"],
      [displayLabel("Description Changed"), summary["Description Changed"] || 0,   "#8b5cf6"],
      [displayLabel("Possible Typo"),       summary["Possible Typo"] || 0,         "#d946ef"],
      [displayLabel("Unknown Format"),      summary["Unknown Format"] || 0,        "#64748b"],
    ];
    drawPie(el.pieChart, data);
    drawBars(el.barChart, data);
  }

  function drawPie(canvas, data) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const total = data.reduce((s, d) => s + d[1], 0);
    const cx = 98, cy = 112, r = 74;
    let angle = -Math.PI / 2;
    if (!total) {
      ctx.fillStyle = "#e5e7eb";
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const [, v, col] of data) {
        const slice = (v / total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath();
        ctx.fillStyle = col; ctx.fill(); angle += slice;
      }
    }
    const isDark = document.documentElement.dataset.theme === "dark";
    data.forEach((d, i) => {
      const y = 32 + i * 26;
      ctx.fillStyle = d[2]; ctx.fillRect(200, y - 10, 12, 12);
      ctx.fillStyle = isDark ? "#e5eefb" : "#172033";
      ctx.font = "12px Segoe UI, Arial";
      ctx.fillText(`${d[0]}: ${d[1]}`, 220, y + 1);
    });
  }

  function drawBars(canvas, data) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(1, ...data.map(d => d[1]));
    const left = 132, top = 16, rh = 28, barMax = canvas.width - left - 64;
    const isDark = document.documentElement.dataset.theme === "dark";
    ctx.font = "12px Segoe UI, Arial";
    data.forEach((d, i) => {
      const y = top + i * rh;
      ctx.fillStyle = isDark ? "#a8b3c7" : "#334155"; ctx.fillText(d[0], 12, y + 14);
      ctx.fillStyle = isDark ? "#273142" : "#e2e8f0"; ctx.fillRect(left, y, barMax, 14);
      ctx.fillStyle = d[2]; ctx.fillRect(left, y, (d[1] / max) * barMax, 14);
      ctx.fillStyle = isDark ? "#e5eefb" : "#172033"; ctx.fillText(String(d[1]), left + barMax + 14, y + 12);
    });
  }

  /* ── CLIPBOARD / DOWNLOAD ─────────────────────────────── */
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  }

  function downloadFile(name, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a"); a.href = url; a.download = name;
    a.click(); URL.revokeObjectURL(url);
  }

  async function copyFormNumbers() {
    const text = getFiltered().map(r => r.displayCode || r.normalizedCode).filter(Boolean).join("\n");
    await copyText(text);
    flashBtn("copyFormNumbersBtn", "✓ Copied!", "📋 Copy Numbers");
  }

  async function copyDescriptions() {
    const text = getFiltered().map(r => {
      const code = r.displayCode || r.normalizedCode;
      return [code, r.description].filter(Boolean).join(" — ");
    }).filter(Boolean).join("\n");
    await copyText(text);
    flashBtn("copyDescriptionsBtn", "✓ Copied!", "📋 Descriptions");
  }

  async function copyEntireTable() {
    const rows = getFiltered();
    const hdrs = ["Status","Code","Original Previous","Original Current","Description","Edition","Source"];
    const body = rows.map(r => [displayLabel(r.status), r.displayCode||r.normalizedCode, r.originalPrevious, r.originalCurrent, r.description, r.edition, r.source||"Current Policy"]);
    const tsv = [hdrs,...body].map(row => row.map(c => String(c||"").replace(/\t/g," ").replace(/\n/g," ")).join("\t")).join("\n");
    await copyText(tsv);
    flashBtn("copyTableBtn", "✓ Copied!", "📋 Copy Table");
  }

  async function copyChecklist() {
    const src = el.resultViewSelect.value;
    const rows = src === "all" ? state.checklistRows : state.checklistRows.filter(r => r.source === src);
    const hdrs = ["Form / Description","Edition","Status","Compared Document"];
    const body = rows.map(r => [r.formDescription, r.edition, r.status, r.source]);
    const tsv = [hdrs,...body].map(row => row.map(c => String(c||"").replace(/\t/g," ").replace(/\n/g," ")).join("\t")).join("\n");
    await copyText(tsv);
    flashBtn("copyExcelBtn","Copied!","Copy for Excel");
  }

  function flashHeader(el, done, orig) {
    el.textContent = done;
    el.classList.add("header-copied");
    window.setTimeout(() => {
      el.textContent = orig;
      el.classList.remove("header-copied");
    }, 1200);
  }

  async function copyColumnCode() {
    const rows = getFiltered();
    const codes = rows.map(r => {
      const edit = state.customEdits.get(r.normalizedCode) || {};
      return edit.displayCode !== undefined ? edit.displayCode : (r.displayCode || r.normalizedCode);
    }).filter(Boolean);
    if (!codes.length) return;
    await copyText(codes.join("\n"));
    flashHeader(document.getElementById("hdrCopyCode"), "Copied! ✔", "Code 📋");
  }

  async function copyColumnDesc() {
    const rows = getFiltered();
    const descs = rows.map(r => {
      const edit = state.customEdits.get(r.normalizedCode) || {};
      return edit.description !== undefined ? edit.description : r.description;
    }).filter(Boolean);
    if (!descs.length) return;
    await copyText(descs.join("\n"));
    flashHeader(document.getElementById("hdrCopyDesc"), "Copied! ✔", "Description 📋");
  }

  async function copyColumnEdit() {
    const rows = getFiltered();
    const editions = rows.map(r => r.edition).filter(Boolean);
    if (!editions.length) return;
    await copyText(editions.join("\n"));
    flashHeader(document.getElementById("hdrCopyEdit"), "Copied! ✔", "Edition 📋");
  }

  /* ── SBS COLUMN COPY ──────────────────────────────────── */
  async function copySbsPrev() {
    const rows = getFiltered();
    const vals = rows.map(r => r.status === "Added" ? "" : (r.originalPrevious || r.displayCode || r.normalizedCode || "")).filter(Boolean);
    if (!vals.length) return;
    await copyText(vals.join("\n"));
    flashHeader(document.getElementById("hdrSbsPrev"), "Copied! \u2714", "Previous Form \ud83d\udccb");
  }

  async function copySbsCurr() {
    const rows = getFiltered();
    const vals = rows.map(r => r.status === "Removed" ? "" : (r.originalCurrent || r.displayCode || r.normalizedCode || "")).filter(Boolean);
    if (!vals.length) return;
    await copyText(vals.join("\n"));
    flashHeader(document.getElementById("hdrSbsCurr"), "Copied! \u2714", "Current Form \ud83d\udccb");
  }

  /* ── CHECKLIST TOGGLE STATE ───────────────────────────── */
  let checklistView = "current";

  function getChecklistRows() {
    const src = el.resultViewSelect.value;
    return src === "all" ? state.checklistRows : state.checklistRows.filter(r => r.source === src);
  }

  /* ── CHECKLIST COLUMN COPY ────────────────────────────── */
  async function copyClForm() {
    const vals = getChecklistRows().map(r => r.formDescription).filter(Boolean);
    if (!vals.length) return;
    await copyText(vals.join("\n"));
    flashHeader(document.getElementById("hdrClForm"), "Copied! \u2714", "Form / Description \ud83d\udccb");
  }

  async function copyClEdition() {
    const vals = getChecklistRows().map(r => r.edition).filter(Boolean);
    if (!vals.length) return;
    await copyText(vals.join("\n"));
    flashHeader(document.getElementById("hdrClEdition"), "Copied! \u2714", "Edition \ud83d\udccb");
  }

  async function copyClStatus() {
    const vals = getChecklistRows().map(r => r.status).filter(Boolean);
    if (!vals.length) return;
    await copyText(vals.join("\n"));
    flashHeader(document.getElementById("hdrClStatus"), "Copied! \u2714", "Status \ud83d\udccb");
  }

  async function copyClSource() {
    const vals = getChecklistRows().map(r => r.source).filter(Boolean);
    if (!vals.length) return;
    await copyText(vals.join("\n"));
    flashHeader(document.getElementById("hdrClSource"), "Copied! \u2714", "Compared Document \ud83d\udccb");
  }

  /* ── CELL CLICK COPY ──────────────────────────────────── */
  function flashCell(td, origText) {
    td.classList.add("cell-flashed");
    const saved = td.textContent;
    td.textContent = "\u2714 Copied";
    window.setTimeout(() => { td.textContent = origText; td.classList.remove("cell-flashed"); }, 900);
  }

  async function handleCellCopy(e) {
    const td = e.target.closest("td.cell-copy");
    if (!td) return;
    const text = td.dataset.copyVal !== undefined ? td.dataset.copyVal : td.textContent.trim();
    if (!text) return;
    await copyText(text);
    flashCell(td, td.textContent.trim());
  }

  /* ── CHECKLIST VIEW TOGGLE ────────────────────────────── */
  function setChecklistView(view) {
    checklistView = view;
    document.getElementById("clToggleCurrent").classList.toggle("active", view === "current");
    document.getElementById("clTogglePrevious").classList.toggle("active", view === "previous");
    state.checklistRows = makeChecklistRows(state.results);
    renderChecklist();
  }

  function toCsv(rows, opts = {}) {
    const hdrs = ["Status","Code","Original Previous","Original Current"];
    if (opts.desc !== false) hdrs.push("Description");
    if (opts.source) hdrs.push("Source");
    if (opts.notes) hdrs.push("User Note");
    hdrs.push("Edition","System Note");
    const body = rows.map(r => {
      const cells = [displayLabel(r.status), r.displayCode||r.normalizedCode, r.originalPrevious, r.originalCurrent];
      if (opts.desc !== false) cells.push(r.description);
      if (opts.source) cells.push(r.source||"Current Policy");
      if (opts.notes) cells.push(state.rowNotes.get(r.normalizedCode)||"");
      cells.push(r.edition, r.notes);
      return cells;
    });
    return [hdrs,...body].map(row => row.map(c => `"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
  }

  function toExcelHtml(rows, opts = {}) {
    const src = el.resultViewSelect.value;
    const label = src === "all" ? "All compared documents" : displaySrcName(src);
    const hdrs = ["Status","Code","Original Previous","Original Current"];
    if (opts.desc !== false) hdrs.push("Description");
    if (opts.source) hdrs.push("Source");
    if (opts.notes) hdrs.push("User Note");
    hdrs.push("Edition");
    const body = rows.map(r => {
      const cells = [displayLabel(r.status), r.displayCode||r.normalizedCode, r.originalPrevious, r.originalCurrent];
      if (opts.desc !== false) cells.push(r.description);
      if (opts.source) cells.push(r.source||"Current Policy");
      if (opts.notes) cells.push(state.rowNotes.get(r.normalizedCode)||"");
      cells.push(r.edition);
      return cells;
    });
    const tbl = (h,b) => `<table border="1"><thead><tr>${h.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${b.map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>${esc(label)}</h1>${tbl(hdrs,body)}</body></html>`;
  }

  /* ── SMART EXPORT ─────────────────────────────────────── */
  function smartRows() {
    let rows = baseRows();
    if (document.getElementById("optDiffsOnly").checked || !document.getElementById("optMatches").checked) {
      rows = rows.filter(r => r.status !== "Match");
    }
    return rows;
  }

  function smartOpts() {
    return {
      desc:   document.getElementById("optDescriptions").checked,
      source: document.getElementById("optSource").checked,
      notes:  document.getElementById("optUserNotes").checked,
    };
  }

  async function smCopyExcel() {
    const rows = smartRows(); const opts = smartOpts();
    const hdrs = ["Status","Code"];
    if (opts.desc) hdrs.push("Description");
    if (opts.source) hdrs.push("Source");
    if (opts.notes) hdrs.push("User Note");
    hdrs.push("Edition");
    const body = rows.map(r => {
      const cells = [displayLabel(r.status), r.displayCode||r.normalizedCode];
      if (opts.desc) cells.push(r.description);
      if (opts.source) cells.push(r.source||"Current Policy");
      if (opts.notes) cells.push(state.rowNotes.get(r.normalizedCode)||"");
      cells.push(r.edition);
      return cells;
    });
    const tsv = [hdrs,...body].map(row => row.map(c => String(c||"").replace(/\t/g," ").replace(/\n/g," ")).join("\t")).join("\n");
    await copyText(tsv);
    flashBtn("smCopyExcelBtn","✓ Copied!","📋 Copy for Excel");
  }

  async function smCopyNumbers() {
    const text = smartRows().map(r => r.displayCode||r.normalizedCode).filter(Boolean).join("\n");
    await copyText(text);
    flashBtn("smCopyNumbersBtn","✓ Copied!","📋 Numbers Only");
  }

  /* ── DRAFT ────────────────────────────────────────────── */
  function draftPayload() {
    return {
      savedAt: new Date().toISOString(),
      previousInput: el.previousInput.value,
      currentInput:  el.currentInput.value,
      quoteInput:    el.quoteInput.value,
      fourthInput:   el.fourthInput.value,
      prefixes: el.prefixInput.value,
      quoteVisible:  !document.getElementById("quotePane").classList.contains("hidden"),
      fourthVisible: !document.getElementById("fourthPane").classList.contains("hidden"),
      resultView: el.resultViewSelect.value,
      rowNotes: Array.from(state.rowNotes.entries()),
      customEdits: Array.from(state.customEdits.entries()),
      pinnedCodes: Array.from(state.pinnedCodes),
    };
  }

  function updateMemoryStatus(savedAt) {
    if (el.memoryStatus) el.memoryStatus.textContent = savedAt ? `Saved locally ${new Date(savedAt).toLocaleString()}.` : "No saved draft yet.";
  }

  function saveDraft() {
    try {
      const p = draftPayload();
      localStorage.setItem(draftKey, JSON.stringify(p));
      updateMemoryStatus(p.savedAt);
    } catch (e) {
      if (el.memoryStatus) el.memoryStatus.textContent = "Draft memory unavailable in this browser.";
    }
  }

  function scheduleDraftSave() {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, 450);
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) { updateMemoryStatus(null); return false; }
      const d = JSON.parse(raw);
      el.previousInput.value = d.previousInput || "";
      el.currentInput.value  = d.currentInput  || "";
      el.quoteInput.value    = d.quoteInput    || "";
      el.fourthInput.value   = d.fourthInput   || "";
      el.prefixInput.value   = d.prefixes || el.prefixInput.value;
      if (d.quoteVisible  || d.quoteInput)  document.getElementById("quotePane").classList.remove("hidden");
      if (d.fourthVisible || d.fourthInput) document.getElementById("fourthPane").classList.remove("hidden");
      const opt = el.resultViewSelect.querySelector(`option[value="${d.resultView}"]`);
      if (d.resultView && opt) el.resultViewSelect.value = d.resultView;
      if (d.rowNotes)    state.rowNotes    = new Map(d.rowNotes);
      if (d.customEdits) state.customEdits = new Map(d.customEdits);
      if (d.pinnedCodes) state.pinnedCodes = new Set(d.pinnedCodes);
      updateMemoryStatus(d.savedAt);
      return true;
    } catch (e) { updateMemoryStatus(null); return false; }
  }

  function clearSavedDraft() {
    try { localStorage.removeItem(draftKey); } catch (e) { }
    updateMemoryStatus(null);
  }

  /* ── UNDO ─────────────────────────────────────────────── */
  function pushUndo() {
    state.undoSnapshot = {
      previousInput: el.previousInput.value,
      currentInput:  el.currentInput.value,
      quoteInput:    el.quoteInput.value,
      fourthInput:   el.fourthInput.value,
      results: [...state.results],
      checklistRows: [...state.checklistRows],
      previousItems: [...state.previousItems],
      currentItems:  [...state.currentItems],
    };
  }

  function showUndo() {
    el.undoToast.classList.add("show");
    window.setTimeout(() => el.undoToast.classList.remove("show"), 7000);
  }

  function undoClear() {
    if (!state.undoSnapshot) return;
    const s = state.undoSnapshot;
    el.previousInput.value = s.previousInput;
    el.currentInput.value  = s.currentInput;
    el.quoteInput.value    = s.quoteInput;
    el.fourthInput.value   = s.fourthInput;
    state.results       = s.results;
    state.checklistRows = s.checklistRows;
    state.previousItems = s.previousItems;
    state.currentItems  = s.currentItems;
    state.undoSnapshot  = null;
    renderPreview(el.previousPreview, state.previousItems);
    renderPreview(el.currentPreview,  state.currentItems);
    renderResults(); renderChecklist();
    updateMetrics(summarize(state.results), null);
    drawCharts(summarize(state.results));
    updateFilterCounts();
    el.undoToast.classList.remove("show");
  }

  /* ── CLEAR ALL ────────────────────────────────────────── */
  function clearAll() {
    pushUndo();
    el.previousInput.value = ""; el.currentInput.value = ""; el.quoteInput.value = ""; el.fourthInput.value = "";
    state.previousItems = []; state.currentItems = []; state.quoteItems = []; state.fourthItems = [];
    state.results = []; state.checklistRows = [];
    renderPreview(el.previousPreview, []); renderPreview(el.currentPreview, []);
    renderPreview(el.quotePreview, []);    renderPreview(el.fourthPreview, []);
    renderResults(); renderChecklist();
    updateMetrics({}, null); updateFilterCounts(); drawCharts({});
    el.lastCompared.textContent = "Not compared";
    el.comparisonTime.textContent = "0.00 sec";
    showUndo();
  }

  /* ── PLAY INLINE ──────────────────────────────────────── */
  function togglePin(code) {
    if (state.pinnedCodes.has(code)) state.pinnedCodes.delete(code);
    else state.pinnedCodes.add(code);
    renderResults(); scheduleDraftSave();
  }

  /* ── MANUAL RE-PAIR ───────────────────────────────────── */
  // Two-click flow: click a row's link icon to arm it, then click another
  // Added/Removed/Unknown row to merge them into one "Manually Linked" row.
  // Exists because the automatic fuzzy matcher (compare.js Pass 3) is a greedy
  // best-match, and can miss or mis-pair forms when several similar ones changed
  // in the same batch — this is the reviewer's override for those cases.
  function handleLinkClick(rowId) {
    if (!state.linkPending) {
      state.linkPending = rowId;
      renderResults();
      return;
    }
    if (state.linkPending === rowId) {
      state.linkPending = null; // clicked the same row again: cancel
      renderResults();
      return;
    }

    const rowA = state.results.find(r => r._id === state.linkPending);
    const rowB = state.results.find(r => r._id === rowId);
    state.linkPending = null;

    if (!rowA || !rowB) { renderResults(); return; }
    if (rowA.status === rowB.status && rowA.status !== "Unknown Format") {
      // Two Added rows or two Removed rows can't represent "the same form changing" —
      // require at least one side to be Removed/Unknown and the other Added/Unknown.
      alert("Link a \"Removed\" or \"Unknown\" row together with an \"Added\" or \"Unknown\" row — not two rows of the same status.");
      renderResults();
      return;
    }

    const merged = window.ComparatorEngine.linkManualPair(rowA, rowB);
    merged._id = rowA._id;
    state.results = state.results.filter(r => r !== rowA && r !== rowB);
    state.results.push(merged);
    state.checklistRows = makeChecklistRows(state.results);
    renderResults(); renderChecklist(); updateFilterCounts();
    scheduleDraftSave();
  }

  /* ── NOTES ────────────────────────────────────────────── */
  function openNote(code) {
    noteTarget = code;
    el.noteCodeBadge.textContent = code;
    el.noteTextarea.value = state.rowNotes.get(code) || "";
    el.noteDialog.showModal();
    window.setTimeout(() => el.noteTextarea.focus(), 60);
  }

  function saveNote() {
    if (!noteTarget) return;
    const v = el.noteTextarea.value.trim();
    if (v) state.rowNotes.set(noteTarget, v);
    else   state.rowNotes.delete(noteTarget);
    el.noteDialog.close(); noteTarget = null;
    renderResults(); scheduleDraftSave();
  }

  /* ── EDITABLE CELLS ───────────────────────────────────── */
  el.resultsBody.addEventListener("focus", e => {
    const ce = e.target.closest("[contenteditable]");
    if (!ce) return;
    ce.textContent = ce.textContent;
  }, true);

  el.resultsBody.addEventListener("blur", e => {
    const ce = e.target.closest("[contenteditable]");
    if (!ce) return;
    const code  = ce.dataset.code;
    const field = ce.dataset.field;
    if (!code || !field) return;
    const value = ce.textContent.trim();
    const orig  = state.results.find(r => r.normalizedCode === code);
    const existing = state.customEdits.get(code) || {};
    if (field === "displayCode") {
      const origVal = orig ? (orig.displayCode || orig.normalizedCode) : "";
      if (value !== origVal) existing.displayCode = value;
      else delete existing.displayCode;
    } else if (field === "description") {
      const origVal = orig ? orig.description : "";
      if (value !== origVal) existing.description = value;
      else delete existing.description;
    }
    if (Object.keys(existing).length) state.customEdits.set(code, existing);
    else state.customEdits.delete(code);
    scheduleDraftSave();

    if (window.ComparatorDataBank && orig && (field === "displayCode" || field === "description")) {
      window.ComparatorDataBank.quickAddCode(
        code,
        field === "description" ? value : orig.description,
        (orig.edition || "").split(" -> ").pop(),
        field === "displayCode" ? value : orig.displayCode
      );
    }
  }, true);

  el.resultsBody.addEventListener("keydown", e => {
    if (e.target.closest("[contenteditable]")) {
      if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
      if (e.key === "Escape") { e.target.blur(); }
    }
  });

  /* ── FILTER CHIPS ─────────────────────────────────────── */
  const chipMap = {
    chipMatch: "Match",
    chipAdded: "Added",
    chipRemoved: "Removed",
    chipChanged: "Edition Changed",
    chipDescChanged: "Description Changed",
    chipTypo: "Possible Typo",
    chipUnknown: "Unknown Format",
    chipManual: "Manually Linked",
  };
  function toggleStatusVisibility(status, forceValue) {
    state.filters[status] = forceValue !== undefined ? forceValue : !(state.filters[status] !== false);
    applyResultSettings();
  }
  for (const [id, status] of Object.entries(chipMap)) {
    const chipEl = document.getElementById(id);
    if (chipEl) chipEl.addEventListener("click", () => toggleStatusVisibility(status));
  }

  /* ── RESULT DISPLAY SETTINGS UI ───────────────────────── */
  document.getElementById("resultSettingsRows").addEventListener("change", e => {
    const vis = e.target.closest("[data-rs-vis]");
    if (vis) { toggleStatusVisibility(vis.getAttribute("data-rs-vis"), vis.checked); return; }
    const lbl = e.target.closest("[data-rs-label]");
    if (lbl) {
      const status = lbl.getAttribute("data-rs-label");
      const v = lbl.value.trim();
      if (v) state.statusLabels[status] = v; else delete state.statusLabels[status];
      applyResultSettings();
    }
  });

  document.getElementById("rsPresetBtn").addEventListener("click", () => {
    Object.assign(state.statusLabels, COWORKER_PRESET);
    applyResultSettings();
  });

  document.getElementById("rsResetBtn").addEventListener("click", () => {
    state.statusLabels = {};
    STATUS_META.forEach(m => { state.filters[m.key] = true; });
    applyResultSettings();
  });

  loadResultSettings();
  applyResultSettings();

  /* ── THEME ────────────────────────────────────────────── */
  const THEME_ORDER = ["light", "dark", "brand"];
  const THEME_LABELS = { light: "Dark Mode", dark: "Brand Theme", brand: "Light Mode" };

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    el.themeToggleBtn.textContent = THEME_LABELS[theme] || "Dark Mode";
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "light";
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    applyTheme(next); drawCharts(summarize(state.results));
    try { localStorage.setItem("formsComparatorTheme", next); } catch (e) { }
  }

  /* ── DATA BANK UI ─────────────────────────────────────── */
  function updateDataBankStatLine() {
    const line = document.getElementById("dataBankStatLine");
    if (!line || !window.ComparatorDataBank) return;
    const s = window.ComparatorDataBank.stats();
    line.textContent = s.totalCodes
      ? `${s.totalCodes} codes learned (${s.manualCodes} manual, ${s.autoCodes} auto) · ${s.totalPrefixes} prefixes`
      : "No data learned yet — run a comparison and it starts building automatically.";
  }

  function renderPrefixChips() {
    const wrap = document.getElementById("dbPrefixList");
    if (!wrap || !window.ComparatorDataBank) return;
    const prefixes = window.ComparatorDataBank.getPrefixes().sort();
    wrap.innerHTML = prefixes.length
      ? prefixes.map(p => `<span class="db-prefix-chip">${esc(p)}<button type="button" data-db-del-prefix="${esc(p)}" title="Remove prefix">✕</button></span>`).join("")
      : '<span style="color:var(--muted)">No learned prefixes yet.</span>';
  }

  function renderDataBankTable() {
    const body = document.getElementById("dataBankBody");
    const statsEl = document.getElementById("dbModalStats");
    if (!body || !window.ComparatorDataBank) return;
    const q = (document.getElementById("dbSearch").value || "").trim().toLowerCase();
    let codes = window.ComparatorDataBank.getCodes().sort((a, b) => (b.timesSeen || 0) - (a.timesSeen || 0));
    if (q) codes = codes.filter(c => c.normalizedCode.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));

    body.innerHTML = codes.length ? codes.map(c => `
      <tr>
        <td>${esc(c.displayCode || c.normalizedCode)}</td>
        <td>${esc(window.ComparatorParser.formatEdition(c.edition || ""))}</td>
        <td>${esc(c.description || "")}</td>
        <td class="db-source-${c.source === "manual" ? "manual" : "auto"}">${c.source === "manual" ? "Manual" : "Auto"}</td>
        <td>${c.timesSeen || 1}</td>
        <td><button class="db-del-btn" type="button" data-db-del-code="${esc(c.normalizedCode)}" title="Remove">🗑</button></td>
      </tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">No entries${q ? " match your search" : " yet"}.</td></tr>`;

    const s = window.ComparatorDataBank.stats();
    statsEl.textContent = `${s.totalCodes} codes · ${s.totalPrefixes} prefixes`;
    renderPrefixChips();
  }

  function openDataBank() {
    renderDataBankTable();
    document.getElementById("dataBankModal").showModal();
  }

  document.getElementById("openDataBankBtn").addEventListener("click", openDataBank);
  document.getElementById("closeDataBankBtn").addEventListener("click", () => document.getElementById("dataBankModal").close());
  document.getElementById("dbSearch").addEventListener("input", renderDataBankTable);

  function recompareIfLoaded() {
    if (el.previousInput.value.trim() || el.currentInput.value.trim()) compare();
  }

  document.getElementById("dbAddCodeBtn").addEventListener("click", () => {
    const codeInput = document.getElementById("dbAddCode");
    const code = codeInput.value.trim();
    if (!code) { codeInput.focus(); return; }
    const edition = document.getElementById("dbAddEdition").value.trim();
    const desc = document.getElementById("dbAddDesc").value.trim();
    window.ComparatorDataBank.quickAddCode(code, desc, edition);
    codeInput.value = ""; document.getElementById("dbAddEdition").value = ""; document.getElementById("dbAddDesc").value = "";
    renderDataBankTable(); updateDataBankStatLine();
    recompareIfLoaded();
  });

  document.getElementById("dbAddPrefixBtn").addEventListener("click", () => {
    const input = document.getElementById("dbAddPrefix");
    if (!input.value.trim()) { input.focus(); return; }
    window.ComparatorDataBank.quickAddPrefix(input.value.trim());
    input.value = "";
    renderPrefixChips(); updateDataBankStatLine();
    recompareIfLoaded();
  });

  document.getElementById("dataBankBody").addEventListener("click", e => {
    const btn = e.target.closest("[data-db-del-code]");
    if (!btn) return;
    window.ComparatorDataBank.removeCode(btn.getAttribute("data-db-del-code"));
    renderDataBankTable(); updateDataBankStatLine();
  });

  document.getElementById("dbPrefixList").addEventListener("click", e => {
    const btn = e.target.closest("[data-db-del-prefix]");
    if (!btn) return;
    window.ComparatorDataBank.removePrefix(btn.getAttribute("data-db-del-prefix"));
    renderPrefixChips(); updateDataBankStatLine();
  });

  document.getElementById("dbExportBtn").addEventListener("click", () => {
    downloadFile(`forms-comparator-databank-${new Date().toISOString().slice(0, 10)}.json`, window.ComparatorDataBank.exportJSON(), "application/json");
  });

  document.getElementById("dbImportFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const result = window.ComparatorDataBank.importJSON(text);
    e.target.value = "";
    if (!result.ok) { alert(`Import failed: ${result.error}`); return; }
    renderDataBankTable(); updateDataBankStatLine();
    alert(`Imported: ${result.added} new codes, ${result.updated} updated, ${result.totalPrefixes} prefixes total.`);
  });

  document.getElementById("dbClearAllBtn").addEventListener("click", () => {
    if (!confirm("Clear the entire data bank? This removes every learned and manually-added code and prefix. This can't be undone.")) return;
    window.ComparatorDataBank.clearAll();
    renderDataBankTable(); updateDataBankStatLine();
  });

  updateDataBankStatLine();

  /* ── KEYBOARD SHORTCUTS ───────────────────────────────── */
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "1") { e.preventDefault(); compare(); }
      else if (e.key === "2") { e.preventDefault(); el.smartExportModal.showModal(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); el.resultsSearch.focus(); el.resultsSearch.select(); }
      else if ((e.key === "z" || e.key === "Z") && state.undoSnapshot) { e.preventDefault(); undoClear(); }
    }
  });

  /* ── EVENT LISTENERS ──────────────────────────────────── */
  document.getElementById("cleanPreviousBtn").addEventListener("click", cleanPrevious);
  document.getElementById("cleanCurrentBtn").addEventListener("click", cleanCurrent);
  document.getElementById("cleanQuoteBtn").addEventListener("click", cleanQuote);
  document.getElementById("cleanFourthBtn").addEventListener("click", cleanFourth);
  document.getElementById("compareBtn").addEventListener("click", compare);
  document.getElementById("compareBtnWorkspace").addEventListener("click", compare);
  document.getElementById("toggleSidebarBtn").addEventListener("click", () => {
    document.querySelector(".app-shell").classList.toggle("sidebar-collapsed");
  });
  document.getElementById("hdrCopyCode").addEventListener("click", copyColumnCode);
  document.getElementById("hdrCopyDesc").addEventListener("click", copyColumnDesc);
  document.getElementById("hdrCopyEdit").addEventListener("click", copyColumnEdit);

  document.getElementById("applySettingsBtn").addEventListener("click", () => {
    state.prefixes = window.ComparatorParser.parsePrefixes(el.prefixInput.value);
    cleanPrevious(); cleanCurrent(); cleanQuote(); cleanFourth();
  });

  document.getElementById("loadSamplesBtn").addEventListener("click", () => {
    el.previousInput.value = samples.previous;
    el.currentInput.value  = samples.current;
    el.quoteInput.value    = samples.quote;
    document.getElementById("quotePane").classList.remove("hidden");
    compare();
  });

  document.getElementById("showQuoteBtn").addEventListener("click", () => {
    document.getElementById("quotePane").classList.remove("hidden","collapsed-doc");
    document.getElementById("collapseQuoteBtn").textContent = "Minimize";
    el.quoteInput.focus(); scheduleDraftSave();
  });

  document.getElementById("showFourthBtn").addEventListener("click", () => {
    document.getElementById("fourthPane").classList.remove("hidden","collapsed-doc");
    document.getElementById("collapseFourthBtn").textContent = "Minimize";
    el.fourthInput.focus(); scheduleDraftSave();
  });

  document.getElementById("collapseQuoteBtn").addEventListener("click", () => {
    const p = document.getElementById("quotePane"); p.classList.toggle("collapsed-doc");
    document.getElementById("collapseQuoteBtn").textContent = p.classList.contains("collapsed-doc") ? "Expand" : "Minimize";
  });

  document.getElementById("collapseFourthBtn").addEventListener("click", () => {
    const p = document.getElementById("fourthPane"); p.classList.toggle("collapsed-doc");
    document.getElementById("collapseFourthBtn").textContent = p.classList.contains("collapsed-doc") ? "Expand" : "Minimize";
  });

  document.getElementById("removeQuoteBtn").addEventListener("click", () => {
    el.quoteInput.value = ""; state.quoteItems = [];
    document.getElementById("quotePane").classList.add("hidden");
    if (el.resultViewSelect.value === "Quote / 3rd Document") el.resultViewSelect.value = "all";
    renderPreview(el.quotePreview, []); compare();
  });

  document.getElementById("removeFourthBtn").addEventListener("click", () => {
    el.fourthInput.value = ""; state.fourthItems = [];
    document.getElementById("fourthPane").classList.add("hidden");
    if (el.resultViewSelect.value === "4th Document") el.resultViewSelect.value = "all";
    renderPreview(el.fourthPreview, []); compare();
  });

  document.getElementById("resultViewSelect").addEventListener("change", () => {
    renderResults(); renderChecklist(); updateFilterCounts();
  });

  // Results body delegation: group collapse, pin, note
  el.resultsBody.addEventListener("click", e => {
    const gb = e.target.closest("[data-group]");
    if (gb) {
      const src = gb.getAttribute("data-group");
      if (state.collapsedGroups.has(src)) state.collapsedGroups.delete(src); else state.collapsedGroups.add(src);
      renderResults(); return;
    }
    const lb = e.target.closest("[data-link]");
    if (lb) { handleLinkClick(lb.getAttribute("data-link")); return; }
    const db = e.target.closest("[data-db-add]");
    if (db) { openDataBankFromRow(db.getAttribute("data-db-add")); return; }
    const pb = e.target.closest("[data-pin]");
    if (pb) { togglePin(pb.getAttribute("data-pin")); return; }
    const nb = e.target.closest("[data-note]");
    if (nb) { openNote(nb.getAttribute("data-note")); return; }
  });

  // SBS body delegation
  el.sbsBody.addEventListener("click", e => {
    const pb = e.target.closest("[data-pin]");  if (pb) { togglePin(pb.getAttribute("data-pin")); return; }
    const nb = e.target.closest("[data-note]"); if (nb) { openNote(nb.getAttribute("data-note")); return; }
  });

  // Search
  el.resultsSearch.addEventListener("input", e => { state.searchQuery = e.target.value; renderResults(); });

  // Diffs Only toggle
  document.getElementById("diffsOnlyBtn").addEventListener("click", () => {
    state.diffsOnly = !state.diffsOnly;
    const btn = document.getElementById("diffsOnlyBtn");
    btn.classList.toggle("toggle-on", state.diffsOnly);
    btn.textContent = state.diffsOnly ? "✓ Diffs Only" : "Diffs Only";
    renderResults();
  });

  // Side-by-Side toggle
  document.getElementById("sideBySideBtn").addEventListener("click", () => {
    state.sideBySide = !state.sideBySide;
    const btn = document.getElementById("sideBySideBtn");
    btn.classList.toggle("toggle-on", state.sideBySide);
    btn.textContent = state.sideBySide ? "✓ Side by Side" : "Side by Side";
    renderResults();
  });

  // Clear
  document.getElementById("clearBtn").addEventListener("click", clearAll);
  document.getElementById("clearBtnWorkspace").addEventListener("click", clearAll);

  // Draft
  document.getElementById("saveDraftBtn").addEventListener("click", saveDraft);
  document.getElementById("clearDraftBtn").addEventListener("click", clearSavedDraft);

  // Theme
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

  // Export buttons
  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    downloadFile("insurance-forms-comparison.csv", toCsv(baseRows()), "text/csv;charset=utf-8");
  });
  document.getElementById("exportExcelBtn").addEventListener("click", () => {
    downloadFile("insurance-forms-comparison.xls", toExcelHtml(baseRows()), "application/vnd.ms-excel;charset=utf-8");
  });
  document.getElementById("exportJsonBtn").addEventListener("click", () => {
    downloadFile("insurance-forms-comparison.json", JSON.stringify(baseRows(), null, 2), "application/json;charset=utf-8");
  });

  // New copy buttons
  document.getElementById("copyFormNumbersBtn").addEventListener("click", copyFormNumbers);
  document.getElementById("copyDescriptionsBtn").addEventListener("click", copyDescriptions);
  document.getElementById("copyTableBtn").addEventListener("click", copyEntireTable);

  // Smart Export modal
  document.getElementById("smartExportBtn").addEventListener("click", () => el.smartExportModal.showModal());
  document.getElementById("closeSmartExportBtn").addEventListener("click", () => el.smartExportModal.close());
  document.getElementById("smCopyExcelBtn").addEventListener("click", smCopyExcel);
  document.getElementById("smCopyNumbersBtn").addEventListener("click", smCopyNumbers);
  document.getElementById("smDownloadCsvBtn").addEventListener("click", () => {
    downloadFile("smart-export.csv", toCsv(smartRows(), smartOpts()), "text/csv;charset=utf-8");
  });
  document.getElementById("smDownloadExcelBtn").addEventListener("click", () => {
    downloadFile("smart-export.xls", toExcelHtml(smartRows(), smartOpts()), "application/vnd.ms-excel;charset=utf-8");
  });

  // Note dialog
  document.getElementById("saveNoteBtn").addEventListener("click", saveNote);
  document.getElementById("clearNoteBtn").addEventListener("click", () => { el.noteTextarea.value = ""; });
  document.getElementById("closeNoteBtn").addEventListener("click", () => { el.noteDialog.close(); noteTarget = null; });
  el.noteTextarea.addEventListener("keydown", e => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); saveNote(); } });

  // Undo
  document.getElementById("undoBtn").addEventListener("click", undoClear);

  // Checklist
  document.getElementById("copyExcelBtn").addEventListener("click", copyChecklist);
  document.getElementById("downloadTsvBtn").addEventListener("click", () => {
    const src = el.resultViewSelect.value;
    const rows = src === "all" ? state.checklistRows : state.checklistRows.filter(r => r.source === src);
    const hdrs = ["Form / Description","Edition","Status","Compared Document"];
    const body = rows.map(r => [r.formDescription,r.edition,r.status,r.source]);
    const tsv = [hdrs,...body].map(row => row.map(c => String(c||"").replace(/\t/g," ").replace(/\n/g," ")).join("\t")).join("\n");
    downloadFile("insurance-forms-checklist.tsv", tsv, "text/tab-separated-values;charset=utf-8");
  });

  // SBS column copy headers
  document.getElementById("hdrSbsPrev").addEventListener("click", copySbsPrev);
  document.getElementById("hdrSbsCurr").addEventListener("click", copySbsCurr);

  // Checklist column copy headers
  document.getElementById("hdrClForm").addEventListener("click", copyClForm);
  document.getElementById("hdrClEdition").addEventListener("click", copyClEdition);
  document.getElementById("hdrClStatus").addEventListener("click", copyClStatus);
  document.getElementById("hdrClSource").addEventListener("click", copyClSource);

  // Checklist Current / Previous toggle
  document.getElementById("clToggleCurrent").addEventListener("click", () => setChecklistView("current"));
  document.getElementById("clTogglePrevious").addEventListener("click", () => setChecklistView("previous"));

  // Checklist cell-click copy (delegated)
  el.excelChecklistBody.addEventListener("click", handleCellCopy);

  // Maximize Full Screen toggle logic
  function toggleMaximize(sectionId, btnId) {
    const section = document.getElementById(sectionId);
    const btn = document.getElementById(btnId);
    const isMax = section.classList.toggle("maximized");
    document.body.classList.toggle("section-maximized", isMax);
    btn.textContent = isMax ? "✕ Minimize" : "⛶ Full Screen";
    // Force browser window redraw to ensure sticky table headers align correctly
    window.dispatchEvent(new Event("resize"));
  }

  document.getElementById("maximizeResultsBtn").addEventListener("click", () => {
    toggleMaximize("results", "maximizeResultsBtn");
  });

  document.getElementById("maximizeChecklistBtn").addEventListener("click", () => {
    toggleMaximize("excelChecklist", "maximizeChecklistBtn");
  });

  // ESC key to exit full screen
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const maxed = document.querySelector(".results-section.maximized");
      if (maxed) {
        maxed.classList.remove("maximized");
        document.body.classList.remove("section-maximized");
        const btnR = document.getElementById("maximizeResultsBtn");
        if (btnR) btnR.textContent = "⛶ Full Screen";
        const btnC = document.getElementById("maximizeChecklistBtn");
        if (btnC) btnC.textContent = "⛶ Full Screen";
        window.dispatchEvent(new Event("resize"));
      }
    }
  });



  // Dialog click-outside-to-close
  [el.smartExportModal, el.noteDialog].forEach(dlg => {
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  });

  // Service Worker (optional, only in live hosted version)
  if ("serviceWorker" in navigator && !document.documentElement.dataset.offlineCopy) {
    navigator.serviceWorker.register("./service-worker.js").then(reg => {
      reg.update();
      if (el.offlineStatus) el.offlineStatus.textContent = "Offline cache is active. The standalone download is also available.";
    }).catch(() => {
      if (el.offlineStatus) el.offlineStatus.textContent = "Standalone offline download is available.";
    });
  }

  // Input auto-save draft & auto-compare (600ms debounce)
  let autoCompareTimer = null;
  [el.previousInput, el.currentInput, el.quoteInput, el.fourthInput, el.prefixInput].forEach(f => {
    f.addEventListener("input", () => {
      scheduleDraftSave();
      window.clearTimeout(autoCompareTimer);
      autoCompareTimer = window.setTimeout(compare, 600);
    });
  });
  window.addEventListener("beforeunload", saveDraft);

  /* ── INIT ─────────────────────────────────────────────── */
  try { applyTheme(localStorage.getItem("formsComparatorTheme") || "light"); }
  catch (e) { applyTheme("light"); }

  const hadDraft = loadDraft();

  renderPreview(el.previousPreview, []);
  renderPreview(el.currentPreview,  []);
  renderPreview(el.quotePreview,    []);
  renderPreview(el.fourthPreview,   []);
  renderResults(); renderChecklist();
  updateMetrics({}, null); updateFilterCounts(); drawCharts({});

  if (hadDraft && (el.previousInput.value || el.currentInput.value || el.quoteInput.value || el.fourthInput.value)) {
    compare();
  }
})();
