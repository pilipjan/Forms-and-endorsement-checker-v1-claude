Attribute VB_Name = "modFormatter"
Option Explicit

' Formats a normalized insurance form code such as CG20100413 as CG 20 10 (04/13).
Public Function DisplayFormCode(ByVal normalizedCode As String) As String
    Dim prefix As String
    Dim formNumber As String
    Dim edition As String

    normalizedCode = UCase$(Replace(CleanText(normalizedCode), " ", vbNullString))

    If Len(normalizedCode) >= 10 And normalizedCode Like "[A-Z][A-Z]########" Then
        prefix = Left$(normalizedCode, 2)
        formNumber = Mid$(normalizedCode, 3, 4)
        edition = Right$(normalizedCode, 4)
        DisplayFormCode = prefix & " " & Left$(formNumber, 2) & " " & Right$(formNumber, 2) & _
                          " (" & Left$(edition, 2) & "/" & Right$(edition, 2) & ")"
    Else
        DisplayFormCode = normalizedCode
    End If
End Function

' Applies the standard status color palette to a results row.
Public Sub ApplyStatusFormat(ByVal targetRow As Range, ByVal statusText As String)
    Select Case UCase$(statusText)
        Case "MATCH"
            targetRow.Interior.Color = RGB(220, 252, 231)
        Case "ADDED"
            targetRow.Interior.Color = RGB(254, 249, 195)
        Case "REMOVED"
            targetRow.Interior.Color = RGB(254, 226, 226)
        Case "EDITION CHANGED"
            targetRow.Interior.Color = RGB(255, 237, 213)
        Case "UNKNOWN FORMAT"
            targetRow.Interior.Color = RGB(229, 231, 235)
        Case Else
            targetRow.Interior.Pattern = xlNone
    End Select
End Sub

' Applies consistent table formatting to parsed preview ranges.
Public Sub FormatPreviewTable(ByVal ws As Worksheet)
    Dim headerRange As Range
    Set headerRange = ws.Range("C5:G5")

    headerRange.Value = Array("Status", "Normalized Code", "Display Code", "Edition", "Description")
    headerRange.Font.Bold = True
    headerRange.Font.Color = RGB(255, 255, 255)
    headerRange.Interior.Color = RGB(30, 64, 175)
    headerRange.HorizontalAlignment = xlCenter

    ws.Range("C:G").ColumnWidth = 24
    ws.Columns("G").ColumnWidth = 54
    ws.Range("C6:G" & MAX_WORKING_ROWS).WrapText = True
End Sub

' Applies professional formatting to the results grid.
Public Sub FormatResultsTable(ByVal ws As Worksheet)
    Dim headerRange As Range
    Set headerRange = ws.Range("A5:G5")

    headerRange.Value = Array("Status", "Normalized Code", "Original Previous", "Original Current", "Description", "Edition", "Notes")
    headerRange.Font.Bold = True
    headerRange.Font.Color = RGB(255, 255, 255)
    headerRange.Interior.Color = RGB(15, 23, 42)
    headerRange.HorizontalAlignment = xlCenter

    ws.Columns("A").ColumnWidth = 20
    ws.Columns("B").ColumnWidth = 22
    ws.Columns("C:D").ColumnWidth = 48
    ws.Columns("E").ColumnWidth = 54
    ws.Columns("F").ColumnWidth = 14
    ws.Columns("G").ColumnWidth = 34
    ws.Range("A6:G" & MAX_WORKING_ROWS).WrapText = True
End Sub
