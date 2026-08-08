/**
 * databank.js — local knowledge base for the Insurance Forms Comparator.
 *
 * Everything here lives in localStorage only (this is still the offline,
 * nothing-leaves-your-browser build — the data bank is just persistence,
 * not tracking). Export/import as JSON lets you carry it to another device.
 *
 * Two kinds of entries:
 *  - codes:    normalizedCode -> { description, edition, prefix, source,
 *                                  timesSeen, firstSeen, lastSeen }
 *  - prefixes: Set of prefix strings learned from codes you've parsed,
 *              merged with the built-in/Settings prefix list at parse time
 *              so recognition improves the more you use the tool.
 *
 * "source" is "manual" (added via Quick Add, or a manual cell edit) or
 * "auto" (picked up from a normal compare). Manual entries are never
 * overwritten by auto-learning, so a correction you made sticks.
 */
(function () {
  const STORAGE_KEY = "formsComparatorDataBankV1";

  function emptyBank() {
    return { version: 1, codes: {}, prefixes: [], updatedAt: null };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyBank();
      const parsed = JSON.parse(raw);
      return { ...emptyBank(), ...parsed, codes: parsed.codes || {}, prefixes: parsed.prefixes || [] };
    } catch {
      return emptyBank();
    }
  }

  function save(bank) {
    bank.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
      return true;
    } catch {
      return false; // storage full/unavailable — data bank just won't persist this session
    }
  }

  let bank = load();

  function derivePrefix(normalizedCode) {
    const m = String(normalizedCode || "").match(/^[A-Z]+/);
    return m ? m[0] : "";
  }

  /** Learn or update one code. Manual entries win over auto ones. */
  function upsertCode(normalizedCode, info, source) {
    if (!normalizedCode) return;
    const now = new Date().toISOString();
    const existing = bank.codes[normalizedCode];
    const prefix = derivePrefix(normalizedCode);

    if (existing) {
      existing.timesSeen = (existing.timesSeen || 1) + 1;
      existing.lastSeen = now;
      // Don't let an auto-learn overwrite a manual correction's description/edition.
      if (source === "manual" || existing.source !== "manual") {
        if (info.description) existing.description = info.description;
        if (info.edition) existing.edition = info.edition;
        if (info.displayCode) existing.displayCode = info.displayCode;
        if (source === "manual") existing.source = "manual";
      }
    } else {
      bank.codes[normalizedCode] = {
        description: info.description || "",
        edition: info.edition || "",
        displayCode: info.displayCode || normalizedCode,
        prefix,
        source: source || "auto",
        timesSeen: 1,
        firstSeen: now,
        lastSeen: now,
      };
    }
    if (prefix && !bank.prefixes.includes(prefix)) bank.prefixes.push(prefix);
  }

  /** Auto-learn every parsed item from a compare run (both sides). */
  function learnFromItems(items) {
    let changed = false;
    for (const item of items || []) {
      if (!item || !item.normalizedCode || item.parseStatus === "Unknown Format" || item.parseStatus === "Blank") continue;
      upsertCode(item.normalizedCode, {
        description: item.description,
        edition: item.edition,
        displayCode: item.displayCode,
      }, "auto");
      changed = true;
    }
    if (changed) save(bank);
    return changed;
  }

  function quickAddCode(normalizedCode, description, edition, displayCode) {
    const code = String(normalizedCode || "").toUpperCase().replace(/\s+/g, "");
    if (!code) return false;
    upsertCode(code, { description, edition, displayCode: displayCode || code }, "manual");
    save(bank);
    return true;
  }

  function quickAddPrefix(prefix) {
    const p = String(prefix || "").toUpperCase().trim();
    if (!p) return false;
    if (!bank.prefixes.includes(p)) {
      bank.prefixes.push(p);
      save(bank);
      return true;
    }
    return false;
  }

  function removeCode(normalizedCode) {
    if (bank.codes[normalizedCode]) {
      delete bank.codes[normalizedCode];
      save(bank);
      return true;
    }
    return false;
  }

  function removePrefix(prefix) {
    const idx = bank.prefixes.indexOf(prefix);
    if (idx >= 0) {
      bank.prefixes.splice(idx, 1);
      save(bank);
      return true;
    }
    return false;
  }

  function clearAll() {
    bank = emptyBank();
    save(bank);
  }

  function getPrefixes() {
    return bank.prefixes.slice();
  }

  function getCodes() {
    return Object.entries(bank.codes).map(([code, v]) => ({ normalizedCode: code, ...v }));
  }

  function stats() {
    const codes = Object.values(bank.codes);
    return {
      totalCodes: codes.length,
      manualCodes: codes.filter(c => c.source === "manual").length,
      autoCodes: codes.filter(c => c.source === "auto").length,
      totalPrefixes: bank.prefixes.length,
      updatedAt: bank.updatedAt,
    };
  }

  function exportJSON() {
    return JSON.stringify(bank, null, 2);
  }

  /**
   * Merge an imported bank into the current one. Manual entries in either
   * bank win over auto ones; between two manual/two auto entries for the
   * same code, the more recently seen one wins.
   */
  function importJSON(jsonText) {
    let incoming;
    try { incoming = JSON.parse(jsonText); } catch { return { ok: false, error: "Invalid JSON file." }; }
    if (!incoming || typeof incoming !== "object" || !incoming.codes) {
      return { ok: false, error: "File doesn't look like a data bank export." };
    }

    let added = 0, updated = 0;
    for (const [code, info] of Object.entries(incoming.codes)) {
      const existing = bank.codes[code];
      if (!existing) {
        bank.codes[code] = info;
        added++;
      } else {
        const incomingWins = info.source === "manual" && existing.source !== "manual"
          ? true
          : (info.source === existing.source && new Date(info.lastSeen || 0) > new Date(existing.lastSeen || 0));
        if (incomingWins) { bank.codes[code] = info; updated++; }
      }
    }
    for (const p of incoming.prefixes || []) {
      if (!bank.prefixes.includes(p)) bank.prefixes.push(p);
    }
    save(bank);
    return { ok: true, added, updated, totalPrefixes: bank.prefixes.length };
  }

  window.ComparatorDataBank = {
    learnFromItems,
    quickAddCode,
    quickAddPrefix,
    removeCode,
    removePrefix,
    clearAll,
    getPrefixes,
    getCodes,
    stats,
    exportJSON,
    importJSON,
  };
})();
