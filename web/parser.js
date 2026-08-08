(function () {
  const defaultPrefixes = [
    "AG", "AP", "ASPCO", "B", "BCG", "BCR", "BCP", "BDEC", "BEONY", "BIL", "BM", "BP",
    "CA", "CF", "CG", "CL", "CM", "CP", "CR", "CU", "CX", "CY",
    "DE", "DL", "DP", "DS", "DX", "EB", "EP", "FB", "FL", "FO", "FP", "GI", "HO", "IH", "IL", "IM",
    "IN", "MC", "MI", "MM", "MP", "OP", "PM", "PN", "PP", "PR", "SE", "SF", "TC", "WC"
  ];

  function cleanText(value) {
    return String(value || "")
      .replace(/\t/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[–—]/g, "-")
      .replace(/[［\[]/g, "(")
      .replace(/[］\]]/g, ")")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parsePrefixes(value) {
    const parts = String(value || "")
      .split(",")
      .map((part) => cleanText(part).toUpperCase())
      .filter(Boolean);
    return parts.length ? parts : defaultPrefixes.slice();
  }

  function formatEdition(edition) {
    if (!edition) return "";
    return edition.length === 4 ? `${edition.slice(0, 2)}/${edition.slice(2)}` : edition;
  }

  function displayFormCode(normalizedCode) {
    if (!normalizedCode) return "";
    const compact = cleanText(normalizedCode).replace(/\s/g, "").toUpperCase();
    // Standard ISO 2-letter prefix + 4-digit form + 4-digit edition
    if (/^[A-Z]{2}\d{8}$/.test(compact)) {
      const prefix = compact.slice(0, 2);
      const form = compact.slice(2, 6);
      const edition = compact.slice(6, 10);
      return `${prefix} ${form.slice(0, 2)} ${form.slice(2)} (${edition.slice(0, 2)}/${edition.slice(2)})`;
    }
    // Non-standard: return as-is (already reasonably formatted)
    return normalizedCode;
  }

  function fixOcrPrefix(str, knownPrefixes) {
    let clean = cleanText(str).trim();
    if (!clean) return clean;
    
    // Safeguard: If the original unmodified prefix is already known, do not substitute!
    const originalPrefixMatch = clean.match(/^([A-Z0-9]{2,8})/i);
    if (originalPrefixMatch) {
      const origPrefix = originalPrefixMatch[1].toUpperCase();
      if ((knownPrefixes || []).some(p => origPrefix === p.toUpperCase() || origPrefix.startsWith(p.toUpperCase()))) {
        return clean;
      }
    }
    
    // substitutions for common numeric OCR typos at the start of a code prefix
    const substitutions = {
      '8': 'B',
      '0': 'O',
      '1': 'I',
      '5': 'S',
      '2': 'Z'
    };
    
    const firstChar = clean.charAt(0);
    if (substitutions[firstChar]) {
      const substituted = substitutions[firstChar] + clean.slice(1);
      // See if it starts with a known prefix
      const match = substituted.match(/^([A-Z]{2,8})/i);
      if (match) {
        const prefix = match[1].toUpperCase();
        if ((knownPrefixes || []).some(p => prefix === p.toUpperCase() || prefix.startsWith(p.toUpperCase()))) {
          return substituted;
        }
      }
    }
    return clean;
  }

  /**
   * In Travelers/ISO spaced form codes (e.g. "IL T0 02 11 89"), the 2-char
   * form-type segment (T0, U3, D2, etc.) always has a digit as the 2nd char.
   * OCR commonly misreads 0→O, 1→I, 8→B, etc.  Fix those in the 2nd position only.
   */
  function fixOcrDigitInFormType(twoCharCode) {
    if (!twoCharCode || twoCharCode.length !== 2) return twoCharCode || "";
    const letterToDigit = {
      'O': '0', 'Q': '0', 'D': '0',
      'I': '1', 'L': '1',
      'Z': '2',
      'S': '5',
      'B': '8',
      'G': '6'
    };
    const first = twoCharCode[0]; // Keep letter (T, U, D, C, etc.)
    const secondRaw = twoCharCode[1].toUpperCase();
    // Only correct if it's a letter that looks like a digit
    const second = (/[A-Z]/.test(secondRaw) && letterToDigit[secondRaw] !== undefined)
      ? letterToDigit[secondRaw]
      : secondRaw;
    return first + second;
  }

  function parseFormLine(rawLine, knownPrefixes) {
    const prefixes = knownPrefixes || defaultPrefixes;
    let clean = cleanText(rawLine);
    
    // Fuzzy OCR prefix correction
    clean = fixOcrPrefix(clean, prefixes);

    const result = {
      raw: rawLine,
      clean,
      normalizedCode: "",
      baseCode: "",
      displayCode: clean,
      edition: "",
      displayEdition: "",
      description: "",
      known: false,
      parseStatus: clean ? "Unknown Format" : "Blank",
    };

    if (!clean) return result;

    // 0. Spaced Travelers/ISO format: "XX XX ## [## ##] description"
    //    e.g. "IL T0 02 11 89 COMMON POLICY DECLARATIONS"
    //         "DX T0 00 11 12 DELUXE PROP COV PART DECLARATIONS"
    //         "CG D2 46 04 19 BLANKET AI-W/COMP OPS IF REQ BY CONTRACT"
    //         "IL T8 00 GENERAL PURPOSE ENDORSEMENT" (no edition)
    //    The 2-char form-type (T0, U3, D2) may have OCR errors in its 2nd char.
    const spacedMatch = clean.match(
      /^([A-Z]{2})\s+([A-Z0-9]{2})\s+(\d{2})\b(?:\s+(\d{2})\b\s+(\d{2})\b)?(?:\s+(.+))?$/i
    );
    if (spacedMatch) {
      const rawPrefix = spacedMatch[1].toUpperCase();
      const rawFormType = spacedMatch[2].toUpperCase();
      const formType = fixOcrDigitInFormType(rawFormType); // e.g. TO→T0
      const formNum = spacedMatch[3];                       // e.g. "02"
      let month = spacedMatch[4] || "";                     // e.g. "11"
      let year  = spacedMatch[5] || "";                     // e.g. "89"
      let description = cleanText(spacedMatch[6] || "");

      // If no month/year captured from the spaced pattern but description starts with
      // a (MM/YY) or MM/YY edition token, promote it to the edition fields.
      // Handles: "CG 20 37 (04/13)" where (04/13) lands in description slot.
      if (!month && !year && description) {
        const trailingEd = description.match(/^\(?(\d{2})\/(\d{2})\)?\s*(.*)?$/);
        if (trailingEd) {
          month       = trailingEd[1];
          year        = trailingEd[2];
          description = cleanText(trailingEd[3] || "");
        }
      }

      const baseCode = `${rawPrefix}${formType}${formNum}`.toUpperCase();
      const edition = (month && year) ? `${month}${year}` : "";
      const normalizedCode = `${baseCode}${edition}`;
      const displayEdition = (month && year) ? `${month}/${year}` : "";
      const displayCode = displayEdition
        ? `${rawPrefix} ${formType} ${formNum} (${displayEdition})`
        : `${rawPrefix} ${formType} ${formNum}`;
      const known = prefixes.some(p => rawPrefix === p.toUpperCase() || rawPrefix.startsWith(p.toUpperCase()));

      return {
        ...result,
        normalizedCode,
        baseCode,
        displayCode,
        edition,
        displayEdition,
        description,
        known,
        parseStatus: "Parsed",
      };
    }

    // 1. Try matching with edition delimiter first: e.g. "BCEE (10/13) COVERAGE ENHANCEMENT"
    // Fits any alphanumeric code, an edition code, and then description.
    const edMatch = clean.match(/^([A-Z0-9\-\s]{2,12})\s*\(?\s*(\d{2})\s*[\/\-]\s*(\d{2})\s*\)?\s*(.*)$/i);
    if (edMatch) {
      const rawCode = cleanText(edMatch[1]).replace(/\s/g, "");
      const edition = `${edMatch[2]}${edMatch[3]}`;
      const description = cleanText(edMatch[4]);
      
      const fallbackMatch = rawCode.match(/^([A-Z0-9]+?)(?=\d{2,6}$)/i) || rawCode.match(/^([A-Z]+)/i);
      const prefix = (prefixes.find(p => rawCode.toUpperCase().startsWith(p.toUpperCase())) || (fallbackMatch ? fallbackMatch[1] : "")).toUpperCase();
      const known = prefixes.some(p => prefix === p.toUpperCase() || prefix.startsWith(p.toUpperCase()));
      
      const normalizedCode = `${rawCode}${edition}`;
      const displayCode = `${rawCode} (${edMatch[2]}/${edMatch[3]})`;

      return {
        ...result,
        normalizedCode,
        baseCode: rawCode,
        displayCode,
        edition,
        displayEdition: `${edMatch[2]}/${edMatch[3]}`,
        description,
        known,
        parseStatus: normalizedCode ? "Parsed" : "Unknown Format",
      };
    }

    // 2. Standard prefix+digits pattern: e.g. "BP0002 COVERAGE FORM"
    // We allow the prefix to have digits (non-greedy alphanumeric matching)
    const match = clean.match(
      /^\s*([A-Z0-9]{2,8}?)\s*(\d{2,6})\s*(?:\(?\s*(\d{2})\s*\/\s*(\d{2})\s*\)?)?/i
    );
    if (!match) return result;

    const rawCode = `${match[1]}${match[2]}`.toUpperCase();
    const fallbackMatch = rawCode.match(/^([A-Z0-9]+?)(?=\d{2,6}$)/i);
    const prefix = (prefixes.find(p => rawCode.startsWith(p.toUpperCase())) || (fallbackMatch ? fallbackMatch[1] : match[1])).toUpperCase();
    const formNumber = match[2];
    const edition = match[3] && match[4] ? `${match[3]}${match[4]}` : "";

    const normalizedCode = `${rawCode}${edition ? edition : ""}`;
    const displayCode = edition
      ? `${rawCode} (${match[3]}/${match[4]})`
      : rawCode;

    const description = cleanText(clean.slice(match[0].length));
    const known = prefixes.some(p => prefix === p.toUpperCase() || prefix.startsWith(p.toUpperCase()));

    return {
      ...result,
      normalizedCode,
      baseCode: rawCode,
      displayCode,
      edition,
      displayEdition: edition ? `${match[3]}/${match[4]}` : "",
      description,
      known,
      parseStatus: normalizedCode ? "Parsed" : "Unknown Format",
    };
  }

  function looksLikeCode(line, knownPrefixes) {
    const clean = cleanText(line).replace(/\s/g, "").toUpperCase();
    if (!clean) return false;
    // Standard compact format: e.g. BP0002, BCEE, ILT00211
    if (/^[A-Z]{2,8}\d{0,6}$/.test(clean)) return true;
    // Spaced Travelers/ISO format after space-removal:
    // 2-letter prefix + 2-alphanum form-type + 2-8 digits (form# + optional month+year)
    // e.g. ILTO021189, DXT0001112, CGD2460419, ILT800
    if (/^[A-Z]{2}[A-Z0-9]{2}\d{2,8}$/.test(clean)) return true;
    return false;
  }

  function looksLikeDescriptionOnly(line) {
    const clean = cleanText(line);
    if (!clean) return false;
    // Standard capitalized uppercase text, not a short code, not an edition
    return /^[A-Z][A-Z\s\-\/\,\(\)\'\.\&]{4,}$/.test(clean) &&
           !/^[A-Z]{2,10}\s*\d{2,}/.test(clean) &&
           !/^\(?[0-9]{2}\/[0-9]{2}\)?$/.test(clean);
  }

  function looksLikeEdition(line) {
    const clean = cleanText(line);
    return /^\s*\(?\s*\d{2}\s*[\/\-]\s*\d{2}(?:\s*[\/\-]\s*\d{2,4})?\s*\)?\s*$/.test(clean);
  }

  function detectSplitColumn(lines, knownPrefixes) {
    const prefixes = knownPrefixes || defaultPrefixes;
    
    // 1. Group non-empty lines separated by blanks
    const groups = [];
    let current = [];
    for (const line of lines) {
      const c = cleanText(line);
      if (!c) {
        if (current.length) { groups.push(current); current = []; }
      } else {
        current.push(c);
      }
    }
    if (current.length) groups.push(current);

    if (groups.length < 2) return null;

    // 2. Classify each group
    const groupTypes = groups.map(g => {
      let codeCount = 0;
      let editionCount = 0;
      let descCount = 0;
      
      for (const line of g) {
        const fixedLine = fixOcrPrefix(line, prefixes);
        if (looksLikeEdition(line)) {
          editionCount++;
        } else if (looksLikeCode(fixedLine, prefixes)) {
          codeCount++;
        } else {
          descCount++;
        }
      }
      
      const total = g.length || 1;
      return {
        lines: g,
        isEdition: (editionCount / total) > 0.7,
        isCode: (codeCount / total) > 0.6,
        isDesc: (descCount / total) > 0.6 && (codeCount / total) < 0.3
      };
    });

    const codeGroup = groupTypes.find(g => g.isCode);
    const editionGroup = groupTypes.find(g => g.isEdition);
    const descGroup = groupTypes.find(g => g.isDesc);

    // Ensure we have at least a Code group and a Description group
    if (codeGroup && descGroup) {
      const codes = codeGroup.lines;
      const descs = descGroup.lines;
      const editions = editionGroup ? editionGroup.lines : [];

      // Mismatch tolerance (must be relatively close in size)
      const maxLen = Math.max(codes.length, descs.length);
      const minLen = Math.min(codes.length, descs.length);
      if (maxLen - minLen > maxLen * 0.4) return null;

      const parsedLines = [];
      for (let i = 0; i < codes.length; i++) {
        const rawCode = codes[i] || "";
        const fixedCode = fixOcrPrefix(rawCode, prefixes);
        const editionStr = editions.length ? (editions[i] || "") : "";
        const descStr = descs[i] || "";
        
        let combined = fixedCode;
        if (editionStr) {
          const cleanEd = cleanText(editionStr);
          if (cleanEd.startsWith("(") && cleanEd.endsWith(")")) {
            combined += ` ${cleanEd}`;
          } else {
            combined += ` (${cleanEd})`;
          }
        }
        if (descStr) {
          combined += ` ${descStr}`;
        }

        const parsed = parseFormLine(combined, prefixes);
        if (parsed.normalizedCode) {
          parsedLines.push(parsed);
        } else {
          // Fallback parsing
          parsedLines.push({
            raw: combined,
            clean: combined,
            normalizedCode: cleanText(fixedCode).replace(/\s/g, ""),
            baseCode: cleanText(fixedCode).replace(/\s/g, ""),
            displayCode: fixedCode,
            edition: editionStr.replace(/[\(\)]/g, ""),
            displayEdition: editionStr.replace(/[\(\)]/g, ""),
            description: descStr,
            known: false,
            parseStatus: "Unknown Format"
          });
        }
      }
      return parsedLines;
    }

    return null;
  }

  function parseSchedule(text, knownPrefixes) {
    const prefixes = knownPrefixes || defaultPrefixes;
    const rawLines = String(text || "").split(/\r?\n/);
    const nonEmpty = rawLines.filter(l => cleanText(l));

    // Try split-column zipping first
    if (nonEmpty.length >= 4) {
      const splitResult = detectSplitColumn(rawLines, prefixes);
      if (splitResult && splitResult.length) return splitResult;
    }

    // Standard linear parse
    return rawLines
      .map((line) => parseFormLine(line, prefixes))
      .filter((item) => item.clean);
  }

  window.ComparatorParser = {
    cleanText,
    parsePrefixes,
    parseFormLine,
    parseSchedule,
    displayFormCode,
    formatEdition,
    defaultPrefixes,
  };
})();

