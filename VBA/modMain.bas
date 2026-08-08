Attribute VB_Name = "modMain"
Option Explicit

' Cleans and previews the Previous Policy pasted schedule.
Public Sub CleanPrevious()
    RunSafely "CleanPreviousCore"
End Sub

' Cleans and previews the Current Policy pasted schedule.
Public Sub CleanCurrent()
    RunSafely "CleanCurrentCore"
End Sub

' Compares Previous and Current policy schedules.
Public Sub ComparePolicies()
    RunSafely "ComparePoliciesCore"
End Sub

' Exports the comparison results to a standalone workbook.
Public Sub ExportComparison()
    RunSafely "ExportComparisonCore"
End Sub

' Clears all pasted input, preview data, results, and dashboard summary values.
Public Sub ClearWorkbook()
    RunSafely "ClearWorkbookCore"
End Sub

' Navigates to the hidden Settings sheet after unhiding it.
Public Sub OpenSettings()
    ThisWorkbook.Worksheets(SHEET_SETTINGS).Visible = xlSheetVisible
    ThisWorkbook.Worksheets(SHEET_SETTINGS).Activate
End Sub

' Core implementation for cleaning the Previous sheet.
Public Sub CleanPreviousCore()
    CleanAndPreviewSheet SHEET_PREVIOUS
End Sub

' Core implementation for cleaning the Current sheet.
Public Sub CleanCurrentCore()
    CleanAndPreviewSheet SHEET_CURRENT
End Sub

' Core implementation for clearing workbook working data.
Public Sub ClearWorkbookCore()
    ClearWorkingArea GetRequiredSheet(SHEET_PREVIOUS), FIRST_INPUT_ROW, 1, 7
    ClearWorkingArea GetRequiredSheet(SHEET_CURRENT), FIRST_INPUT_ROW, 1, 7
    ClearWorkingArea GetRequiredSheet(SHEET_RESULTS), RESULTS_FIRST_ROW, 1, 7
    GetRequiredSheet(SHEET_DASHBOARD).Range("B4:B11").ClearContents
    GetRequiredSheet(SHEET_DASHBOARD).Range("B17:B18").ClearContents
    GetRequiredSheet(SHEET_DASHBOARD).Range("E4:F8").ClearContents
    FormatPreviewTable GetRequiredSheet(SHEET_PREVIOUS)
    FormatPreviewTable GetRequiredSheet(SHEET_CURRENT)
    FormatResultsTable GetRequiredSheet(SHEET_RESULTS)
End Sub
