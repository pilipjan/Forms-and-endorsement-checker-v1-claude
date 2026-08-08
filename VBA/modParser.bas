Attribute VB_Name = "modParser"
Option Explicit

' Parses a raw insurance form line into a dictionary with code, edition, description, and status fields.
Public Function ParseFormLine(ByVal rawLine As String) As Object
    Dim result As Object
    Dim cleaned As String
    Dim regex As Object
    Dim matches As Object
    Dim match As Object
    Dim prefix As String
    Dim numberPart As String
    Dim editionPart As String
    Dim description As String
    Dim consumedLength As Long

    Set result = NewDictionary()
    cleaned = CleanText(rawLine)

    result("Raw") = rawLine
    result("Clean") = cleaned
    result("NormalizedCode") = vbNullString
    result("BaseCode") = vbNullString
    result("DisplayCode") = cleaned
    result("Edition") = vbNullString
    result("Description") = vbNullString
    result("Known") = False

    If Len(cleaned) = 0 Then
        Set ParseFormLine = result
        Exit Function
    End If

    Set regex = CreateObject("VBScript.RegExp")
    regex.IgnoreCase = True
    regex.Global = False
    regex.Pattern = "^\s*([A-Z]{2})\s*([0-9]{2})\s*([0-9]{2})\s*(?:\(?\s*([0-9]{2})\s*/?\s*([0-9]{2})\s*\)?)?"

    If regex.Test(cleaned) Then
        Set matches = regex.Execute(cleaned)
        Set match = matches(0)
        prefix = UCase$(match.SubMatches(0))
        numberPart = match.SubMatches(1) & match.SubMatches(2)
        editionPart = vbNullString

        If match.SubMatches.Count >= 5 Then
            If Len(match.SubMatches(3)) > 0 And Len(match.SubMatches(4)) > 0 Then
                editionPart = match.SubMatches(3) & match.SubMatches(4)
            End If
        End If

        consumedLength = match.Length
        description = CleanText(Mid$(cleaned, consumedLength + 1))

        result("BaseCode") = prefix & numberPart
        result("Edition") = editionPart
        result("NormalizedCode") = prefix & numberPart & editionPart
        result("DisplayCode") = DisplayFormCode(prefix & numberPart & editionPart)
        result("Description") = description
        result("Known") = IsKnownPrefix(prefix)
    End If

    Set ParseFormLine = result
End Function

' Returns True when the code prefix is configured as a known insurance form prefix.
Public Function IsKnownPrefix(ByVal prefix As String) As Boolean
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim cell As Range

    prefix = UCase$(CleanText(prefix))
    Set ws = GetRequiredSheet(SHEET_SETTINGS)
    lastRow = LastUsedRowInColumn(ws, 1, 2)

    For Each cell In ws.Range("A2:A" & lastRow)
        If UCase$(CleanText(cell.Value)) = prefix Then
            IsKnownPrefix = True
            Exit Function
        End If
    Next cell
End Function

' Cleans and previews the pasted schedule on the selected input sheet.
Public Sub CleanAndPreviewSheet(ByVal sheetName As String)
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim rowNumber As Long
    Dim parsed As Object
    Dim outputRow As Long
    Dim rawLine As String

    Set ws = GetRequiredSheet(sheetName)
    Application.StatusBar = "Cleaning and parsing " & sheetName & "..."

    ClearWorkingArea ws, CLEAN_FIRST_ROW, 3, 7
    FormatPreviewTable ws

    lastRow = LastUsedRowInColumn(ws, RAW_COLUMN, FIRST_INPUT_ROW)
    outputRow = CLEAN_FIRST_ROW

    For rowNumber = FIRST_INPUT_ROW To lastRow
        rawLine = NzText(ws.Cells(rowNumber, RAW_COLUMN).Value)
        If Len(CleanText(rawLine)) > 0 Then
            Set parsed = ParseFormLine(rawLine)
            If Len(parsed("NormalizedCode")) > 0 And parsed("Known") Then
                ws.Cells(outputRow, 3).Value = "Parsed"
            Else
                ws.Cells(outputRow, 3).Value = "Unknown Format"
            End If
            ws.Cells(outputRow, 4).Value = parsed("NormalizedCode")
            ws.Cells(outputRow, 5).Value = parsed("DisplayCode")
            ws.Cells(outputRow, 6).Value = FormatEdition(parsed("Edition"))
            ws.Cells(outputRow, 7).Value = parsed("Description")
            ApplyStatusFormat ws.Range("C" & outputRow & ":G" & outputRow), ws.Cells(outputRow, 3).Value
            outputRow = outputRow + 1
        End If
    Next rowNumber

    ws.Range("C6:G" & Application.Max(outputRow, 6)).Borders.Color = RGB(226, 232, 240)
End Sub

' Formats a compact edition string as MM/YY.
Public Function FormatEdition(ByVal edition As String) As String
    edition = CleanText(edition)
    If Len(edition) = 4 Then
        FormatEdition = Left$(edition, 2) & "/" & Right$(edition, 2)
    Else
        FormatEdition = edition
    End If
End Function
