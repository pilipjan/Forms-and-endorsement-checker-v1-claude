(function () {
  function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function getSimilarity(a, b) {
    const cleanA = String(a || "").trim().toUpperCase();
    const cleanB = String(b || "").trim().toUpperCase();
    const distance = levenshtein(cleanA, cleanB);
    const maxLen = Math.max(cleanA.length, cleanB.length);
    if (maxLen === 0) return 1.0;
    return (maxLen - distance) / maxLen;
  }

  function buildKnownMap(items) {
    const map = new Map();
    const unknown = [];

    for (const item of items) {
      if (item.known && item.normalizedCode) {
        if (!map.has(item.normalizedCode)) {
          map.set(item.normalizedCode, { ...item, duplicates: [] });
        } else {
          map.get(item.normalizedCode).duplicates.push(item.raw);
        }
      } else {
        unknown.push(item);
      }
    }

    return { map, unknown };
  }

  function buildBaseLookup(map) {
    const lookup = new Map();
    for (const [normalizedCode, item] of map.entries()) {
      if (item.baseCode && !lookup.has(item.baseCode)) {
        lookup.set(item.baseCode, normalizedCode);
      }
    }
    return lookup;
  }

  function preferredDescription(previousItem, currentItem) {
    return currentItem.description || previousItem.description || "";
  }

  function makeResult(status, normalizedCode, previousItem, currentItem, notes, extra) {
    const edition = status === "Edition Changed"
      ? `${window.ComparatorParser.formatEdition(previousItem.edition)} -> ${window.ComparatorParser.formatEdition(currentItem.edition)}`
      : window.ComparatorParser.formatEdition((currentItem || previousItem || {}).edition || "");

    // Prefer the parser item's own displayCode (preserves spaces/formatting e.g. "IL T8 01 (10/93)")
    // Fall back to displayFormCode() only for standard compact codes (e.g. "ILT00211")
    const activeItem = currentItem || previousItem;
    const displayCode = (activeItem && activeItem.displayCode)
      ? activeItem.displayCode
      : (normalizedCode ? window.ComparatorParser.displayFormCode(normalizedCode) : "");

    // Surface duplicate raw lines that collapsed into this same normalized code,
    // so a repeated form on the schedule isn't silently dropped from the comparison.
    const dupCount =
      (previousItem && previousItem.duplicates ? previousItem.duplicates.length : 0) +
      (currentItem && currentItem.duplicates ? currentItem.duplicates.length : 0);

    return {
      status,
      normalizedCode: normalizedCode || "",
      displayCode,
      originalPrevious: previousItem ? previousItem.raw : "",
      originalCurrent: currentItem ? currentItem.raw : "",
      description: previousItem && currentItem ? preferredDescription(previousItem, currentItem) : ((currentItem || previousItem || {}).description || ""),
      edition,
      notes,
      source: (activeItem || {}).source,
      duplicateCount: dupCount,
      duplicateLines: [
        ...((previousItem && previousItem.duplicates) || []),
        ...((currentItem && currentItem.duplicates) || []),
      ],
      // 0-1 similarity score when this row came from fuzzy/description matching; null for exact matches.
      confidence: extra && typeof extra.confidence === "number" ? extra.confidence : null,
      manual: !!(extra && extra.manual),
    };
  }


  function compareSchedules(previousItems, currentItems) {
    const previous = buildKnownMap(previousItems);
    const current = buildKnownMap(currentItems);
    const currentBaseLookup = buildBaseLookup(current.map);
    const previousBaseLookup = buildBaseLookup(previous.map);
    const matchedCurrentCodes = new Set();
    const matchedPreviousCodes = new Set();
    const results = [];

    // Pass 1: Exact matches (same code and edition)
    for (const [previousCode, previousItem] of previous.map.entries()) {
      if (current.map.has(previousCode)) {
        const currentItem = current.map.get(previousCode);
        matchedCurrentCodes.add(previousCode);
        matchedPreviousCodes.add(previousCode);
        const sim = getSimilarity(previousItem.description, currentItem.description);

        if (sim === 1.0) {
          results.push(makeResult("Match", previousCode, previousItem, currentItem, "Exact form, edition and description match.", { confidence: sim }));
        } else if (sim >= 0.85) {
          results.push(makeResult("Possible Typo", previousCode, previousItem, currentItem, `Possible description typo (${Math.round(sim * 100)}% similar).`, { confidence: sim }));
        } else {
          results.push(makeResult("Description Changed", previousCode, previousItem, currentItem, `Description updated (${Math.round(sim * 100)}% similar).`, { confidence: sim }));
        }
      }
    }

    // Pass 2: BaseCode matches (Edition Changed)
    for (const [previousCode, previousItem] of previous.map.entries()) {
      if (matchedPreviousCodes.has(previousCode)) continue;

      if (currentBaseLookup.has(previousItem.baseCode)) {
        const currentCode = currentBaseLookup.get(previousItem.baseCode);
        if (!matchedCurrentCodes.has(currentCode)) {
          const currentItem = current.map.get(currentCode);
          matchedCurrentCodes.add(currentCode);
          matchedPreviousCodes.add(previousCode);
          results.push(makeResult("Edition Changed", currentItem.normalizedCode, previousItem, currentItem, "Same form number with a different edition."));
        }
      }
    }

    // Pass 3: Fuzzy description matching for unmatched forms (e.g. CG20110413 vs CG20101219)
    for (const [previousCode, previousItem] of previous.map.entries()) {
      if (matchedPreviousCodes.has(previousCode)) continue;

      let bestScore = -1;
      let bestCurrentCode = null;

      for (const [currentCode, currentItem] of current.map.entries()) {
        if (matchedCurrentCodes.has(currentCode)) continue;

        const descSim = getSimilarity(previousItem.description, currentItem.description);
        const codeSim = getSimilarity(previousItem.baseCode, currentItem.baseCode);

        // Strong candidate if description matches exactly, or description is very similar AND code is similar
        if (descSim === 1.0 || (descSim >= 0.80 && codeSim >= 0.60)) {
          const score = descSim * 0.7 + codeSim * 0.3;
          if (score > bestScore) {
            bestScore = score;
            bestCurrentCode = currentCode;
          }
        }
      }

      if (bestCurrentCode) {
        const currentItem = current.map.get(bestCurrentCode);
        matchedCurrentCodes.add(bestCurrentCode);
        matchedPreviousCodes.add(previousCode);

        const descSim = getSimilarity(previousItem.description, currentItem.description);
        const codeDiffers = previousItem.baseCode !== currentItem.baseCode;
        const editDiffers = previousItem.edition !== currentItem.edition;

        let status = "Edition Changed";
        let note = "Form code or edition updated.";

        if (codeDiffers && descSim === 1.0) {
          status = "Edition Changed";
          note = `Form code updated from ${window.ComparatorParser.displayFormCode(previousItem.normalizedCode)} (descriptions match).`;
        } else if (descSim >= 0.85) {
          status = "Possible Typo";
          note = `Possible form number/description discrepancy (${Math.round(descSim * 100)}% description similarity).`;
        } else {
          status = "Description Changed";
          note = `Form updated (${Math.round(descSim * 100)}% description similarity).`;
        }

        results.push(makeResult(status, currentItem.normalizedCode, previousItem, currentItem, note, { confidence: descSim }));
      }
    }

    // Pass 4: Remaining unmatched previous items are Removed
    for (const [previousCode, previousItem] of previous.map.entries()) {
      if (!matchedPreviousCodes.has(previousCode)) {
        results.push(makeResult("Removed", previousCode, previousItem, null, "Present in Previous only."));
      }
    }

    // Pass 5: Remaining unmatched current items are Added
    for (const [currentCode, currentItem] of current.map.entries()) {
      if (!matchedCurrentCodes.has(currentCode)) {
        results.push(makeResult("Added", currentCode, null, currentItem, "Present in Current only."));
      }
    }

    for (const item of previous.unknown) {
      results.push({
        status: "Unknown Format",
        normalizedCode: item.clean,
        displayCode: item.clean,
        originalPrevious: item.raw,
        originalCurrent: "",
        description: item.description || "",
        edition: window.ComparatorParser.formatEdition(item.edition),
        notes: "Review raw Previous input.",
      });
    }

    for (const item of current.unknown) {
      results.push({
        status: "Unknown Format",
        normalizedCode: item.clean,
        displayCode: item.clean,
        originalPrevious: "",
        originalCurrent: item.raw,
        description: item.description || "",
        edition: window.ComparatorParser.formatEdition(item.edition),
        notes: "Review raw Current input.",
      });
    }

    return {
      results,
      previousKnownCount: previous.map.size,
      currentKnownCount: current.map.size,
      previousCount: previousItems.length,
      currentCount: currentItems.length,
      unknownCount: previous.unknown.length + current.unknown.length,
    };
  }

  /**
   * Manually merge two unmatched result rows (e.g. an "Added" row and a "Removed" row,
   * or either paired with an "Unknown Format" row) that a human reviewer has confirmed
   * are the same form. Used when the automatic matching passes in compareSchedules()
   * pick the wrong pairing or miss one entirely (see Pass 3's greedy-match limitation).
   * Returns a new result object with status "Manually Linked"; does not mutate inputs.
   */
  function linkManualPair(rowA, rowB) {
    if (!rowA || !rowB) throw new Error("linkManualPair requires two rows");

    const prevRow = rowA.originalPrevious ? rowA : (rowB.originalPrevious ? rowB : null);
    const currRow = rowA.originalCurrent ? rowA : (rowB.originalCurrent ? rowB : null);

    const displayCode = (currRow || prevRow || rowA).displayCode || rowA.displayCode || rowB.displayCode;
    const description = (currRow && currRow.description) || (prevRow && prevRow.description) || rowA.description || rowB.description;

    let edition = "";
    if (prevRow && currRow && prevRow.edition !== currRow.edition) {
      edition = `${prevRow.edition || ""} -> ${currRow.edition || ""}`;
    } else {
      edition = (currRow || prevRow || rowA).edition || "";
    }

    return {
      status: "Manually Linked",
      normalizedCode: (currRow || prevRow || rowA).normalizedCode || "",
      displayCode,
      originalPrevious: (prevRow && prevRow.originalPrevious) || "",
      originalCurrent: (currRow && currRow.originalCurrent) || "",
      description,
      edition,
      notes: "Manually linked by reviewer — verify this is the same form before relying on it.",
      source: (currRow || prevRow || rowA).source,
      duplicateCount: 0,
      duplicateLines: [],
      confidence: null,
      manual: true,
    };
  }

  window.ComparatorEngine = {
    compareSchedules,
    linkManualPair,
  };
})();

