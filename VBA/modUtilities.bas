Attribute VB_Name = "modUtilities"
Option Explicit

Public Const APP_VERSION As String = "1.0.0"
Public Const APP_DEVELOPER As String = "Codex"

Public Const SHEET_HOME As String = "Home"
Public Const SHEET_PREVIOUS As String = "Previous"
Public Const SHEET_CURRENT As String = "Current"
Public Const SHEET_RESULTS As String = "Results"
Public Const SHEET_DASHBOARD As String = "Dashboard"
Public Const SHEET_SETTINGS As String = "Settings"

Public Const FIRST_INPUT_ROW As Long = 6
Public Const RAW_COLUMN As Long = 1
Public Const CLEAN_FIRST_ROW As Long = 6
Public Const RESULTS_FIRST_ROW As Long = 6
Public Const MAX_WORKING_ROWS As Long = 5000

Public Enum ComparatorStatus
    StatusMatch = 1
    StatusAdded = 2
    StatusRemoved = 3
    StatusEditionChanged = 4
    StatusUnknown = 5
End Enum

' Runs a macro with common Excel performance settings and graceful cleanup.
Public Sub RunSafely(ByVal procedureName As String)
    Dim previousScreenUpdating As Boolean
    Dim previousEnableEvents As Boolean
    Dim previousCalculation As XlCalculation

    On Error GoTo ErrorHandler

    previousScreenUpdating = Application.ScreenUpdating
    previousEnableEvents = Application.EnableEvents
    previousCalculation = Application.Calculation

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    Application.StatusBar = "Insurance comparator: running " & procedureName & "..."

    Application.Run procedureName

CleanExit:
    Application.ScreenUpdating = previousScreenUpdating
    Application.EnableEvents = previousEnableEvents
    Application.Calculation = previousCalculation
    Application.StatusBar = False
    Exit Sub

ErrorHandler:
    MsgBox "The comparator could not complete '" & procedureName & "'." & vbCrLf & _
           "Details: " & Err.Description, vbExclamation, "Insurance Comparator"
    Resume CleanExit
End Sub

' Returns a worksheet by name and raises a clear error when it is missing.
Public Function GetRequiredSheet(ByVal sheetName As String) As Worksheet
    On Error GoTo MissingSheet
    Set GetRequiredSheet = ThisWorkbook.Worksheets(sheetName)
    Exit Function

MissingSheet:
    Err.Raise vbObjectError + 1100, "GetRequiredSheet", "Missing required sheet: " & sheetName
End Function

' Normalizes whitespace and common OCR punctuation artifacts in a raw pasted line.
Public Function CleanText(ByVal rawText As String) As String
    Dim cleaned As String
    cleaned = CStr(rawText)
    cleaned = Replace(cleaned, vbTab, " ")
    cleaned = Replace(cleaned, ChrW(160), " ")
    cleaned = Replace(cleaned, ChrW(8211), "-")
    cleaned = Replace(cleaned, ChrW(8212), "-")
    cleaned = Replace(cleaned, "（", "(")
    cleaned = Replace(cleaned, "）", ")")
    cleaned = Replace(cleaned, "[", "(")
    cleaned = Replace(cleaned, "]", ")")
    cleaned = WorksheetFunction.Trim(cleaned)
    CleanText = cleaned
End Function

' Builds or retrieves a late-bound scripting dictionary.
Public Function NewDictionary() As Object
    Set NewDictionary = CreateObject("Scripting.Dictionary")
End Function

' Returns the last used row in a worksheet column, never above the requested minimum.
Public Function LastUsedRowInColumn(ByVal ws As Worksheet, ByVal columnNumber As Long, ByVal minimumRow As Long) As Long
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, columnNumber).End(xlUp).Row
    If lastRow < minimumRow Then
        LastUsedRowInColumn = minimumRow
    Else
        LastUsedRowInColumn = lastRow
    End If
End Function

' Clears a worksheet working area while preserving the designed header area.
Public Sub ClearWorkingArea(ByVal ws As Worksheet, ByVal firstRow As Long, ByVal firstCol As Long, ByVal lastCol As Long)
    ws.Range(ws.Cells(firstRow, firstCol), ws.Cells(MAX_WORKING_ROWS, lastCol)).ClearContents
    ws.Range(ws.Cells(firstRow, firstCol), ws.Cells(MAX_WORKING_ROWS, lastCol)).Interior.Pattern = xlNone
End Sub

' Writes a timestamp to the dashboard metadata area.
Public Sub SetLastCompared(ByVal comparisonSeconds As Double)
    Dim ws As Worksheet
    Set ws = GetRequiredSheet(SHEET_DASHBOARD)
    ws.Range("B17").Value = Now
    ws.Range("B18").Value = comparisonSeconds
    ws.Range("B17").NumberFormat = "yyyy-mm-dd hh:mm"
    ws.Range("B18").NumberFormat = "0.00 ""sec"""
End Sub

' Converts empty variants to a zero-length string.
Public Function NzText(ByVal value As Variant) As String
    If IsError(value) Or IsNull(value) Or IsEmpty(value) Then
        NzText = vbNullString
    Else
        NzText = CStr(value)
    End If
End Function
