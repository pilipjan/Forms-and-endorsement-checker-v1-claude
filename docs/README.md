# Insurance Forms & Endorsements Comparator

Version 1.0.0

This macro-enabled Excel workbook compares insurance Forms & Endorsements schedules between a Previous Policy and a Current Policy. It is designed for offline commercial insurance processing where users paste text copied from PDFs, OCR, carrier systems, or spreadsheets.

## Workflow

1. Paste raw previous policy schedule text into the `Previous` sheet.
2. Paste raw current policy schedule text into the `Current` sheet.
3. Click `Clean Previous` and `Clean Current` to preview parsed codes, editions, and descriptions.
4. Correct any obvious OCR errors in the pasted raw input.
5. Click `Compare Policies`.
6. Review `Results` and `Dashboard`.
7. Use `Export Results` to save a standalone `.xlsx` copy of the comparison.

## Architecture

- `modMain` exposes button macros and user workflow entry points.
- `modParser` cleans raw text and extracts prefix, form number, edition, and description.
- `modCompare` performs dictionary-based comparisons by normalized form code and base code.
- `modFormatter` formats display codes and applies status colors.
- `modDashboard` updates summary cards and chart helper data.
- `modExport` exports comparison results.
- `modUtilities` centralizes sheet names, constants, shared cleanup, and safe execution.

The parsing and comparison layers are deliberately separate so future PDF import, OCR import, AI summary, or broader policy comparison features can feed parsed records into the same comparison engine.

## Status Rules

- `Match`: same normalized code and edition appears in both policies.
- `Added`: appears only in Current.
- `Removed`: appears only in Previous.
- `Edition Changed`: same form prefix and number, different edition.
- `Unknown Format`: parser could not identify a configured form code pattern.

## Settings

The hidden `Settings` sheet stores known prefixes and default status colors. Use the Home button `Settings` to unhide it. Add prefixes such as new carrier-specific forms under the existing prefix list.

## Notes

The workbook uses VBA only and requires no external services. Macros must be enabled for buttons and automation to work.
