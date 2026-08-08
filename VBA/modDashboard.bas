Attribute VB_Name = "modDashboard"
Option Explicit

' Refreshes all Dashboard summary formulas and chart source values.
Public Sub RefreshDashboard()
    Dim ws As Worksheet
    Dim resultsWs As Worksheet
    Dim lastRow As Long
    Dim totalCompared As Long
    Dim knownOutcomes As Long

    Set ws = GetRequiredSheet(SHEET_DASHBOARD)
    Set resultsWs = GetRequiredSheet(SHEET_RESULTS)

    lastRow = LastUsedRowInColumn(resultsWs, 1, RESULTS_FIRST_ROW)

    ws.Range("B4").Value = CountInputRows(SHEET_PREVIOUS)
    ws.Range("B5").Value = CountInputRows(SHEET_CURRENT)
    ws.Range("B6").Value = CountStatus("Match")
    ws.Range("B7").Value = CountStatus("Added")
    ws.Range("B8").Value = CountStatus("Removed")
    ws.Range("B9").Value = CountStatus("Edition Changed")
    ws.Range("B10").Value = CountStatus("Unknown Format")

    totalCompared = Application.Max(1, lastRow - RESULTS_FIRST_ROW + 1)
    knownOutcomes = ws.Range("B6").Value + ws.Range("B7").Value + ws.Range("B8").Value + ws.Range("B9").Value
    ws.Range("B11").Value = knownOutcomes / totalCompared
    ws.Range("B11").NumberFormat = "0%"

    ws.Range("E4:F8").Value = Array( _
        Array("Match", ws.Range("B6").Value), _
        Array("Added", ws.Range("B7").Value), _
        Array("Removed", ws.Range("B8").Value), _
        Array("Edition Changed", ws.Range("B9").Value), _
        Array("Unknown", ws.Range("B10").Value))

    ws.Range("B4:B10").NumberFormat = "#,##0"
End Sub

' Counts nonblank raw input rows on a policy input sheet.
Public Function CountInputRows(ByVal sheetName As String) As Long
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim rowNumber As Long
    Dim countValue As Long

    Set ws = GetRequiredSheet(sheetName)
    lastRow = LastUsedRowInColumn(ws, RAW_COLUMN, FIRST_INPUT_ROW)

    For rowNumber = FIRST_INPUT_ROW To lastRow
        If Len(CleanText(ws.Cells(rowNumber, RAW_COLUMN).Value)) > 0 Then countValue = countValue + 1
    Next rowNumber
    CountInputRows = countValue
End Function

' Counts result rows with the supplied status text.
Public Function CountStatus(ByVal statusText As String) As Long
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim rowNumber As Long
    Dim countValue As Long

    Set ws = GetRequiredSheet(SHEET_RESULTS)
    lastRow = LastUsedRowInColumn(ws, 1, RESULTS_FIRST_ROW)

    For rowNumber = RESULTS_FIRST_ROW To lastRow
        If UCase$(CleanText(ws.Cells(rowNumber, 1).Value)) = UCase$(statusText) Then countValue = countValue + 1
    Next rowNumber
    CountStatus = countValue
End Function
