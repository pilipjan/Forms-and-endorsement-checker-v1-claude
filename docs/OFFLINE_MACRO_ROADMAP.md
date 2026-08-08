# Offline Macro Roadmap

The online comparator is the source of truth for the first working version. Build the offline Excel macro workbook after the workflow has been tested with real schedules.

## Phase 1: Validate Rules Online

- Test real Previous and Current schedules in the web app.
- Add missing known prefixes in the Settings field.
- Collect examples of OCR lines that should parse but currently appear as `Unknown Format`.
- Confirm whether `Edition Changed` should suppress separate `Added` and `Removed` rows for the same base form.

## Phase 2: Improve Export

- Add `.xlsx` export from the web app.
- Preserve status colors in the exported workbook.
- Include a dashboard sheet in the export.

## Phase 3: Build Offline Excel Version

- Port `web/parser.js` to `VBA/modParser.bas`.
- Port `web/compare.js` to `VBA/modCompare.bas`.
- Create the `.xlsm` shell manually or in an Office environment where trusted VBA project access is enabled.
- Add buttons for `CleanPrevious`, `CleanCurrent`, `ComparePolicies`, `ExportComparison`, and `ClearWorkbook`.
- Keep the workbook offline-only and macro-enabled.

## Phase 4: Future Enhancements

- PDF import.
- OCR cleanup rules.
- AI summary of meaningful policy changes.
- Batch comparison across multiple policies.
