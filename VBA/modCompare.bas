Attribute VB_Name = "modCompare"
Option Explicit

' Compares Previous and Current parsed schedules and writes the Results sheet.
Public Sub ComparePoliciesCore()
    Dim startTime As Double
    Dim previousItems As Object
    Dim currentItems As Object
    Dim previousUnknowns As Collection
    Dim currentUnknowns As Collection
    Dim resultsWs As Worksheet
    Dim key As Variant
    Dim rowNumber As Long
    Dim previousItem As Object
    Dim currentItem As Object
    Dim baseLookup As Object
    Dim currentBase As String

    startTime = Timer
    Application.StatusBar = "Comparing policy forms..."

    CleanAndPreviewSheet SHEET_PREVIOUS
    CleanAndPreviewSheet SHEET_CURRENT

    Set previousItems = BuildParsedDictionary(SHEET_PREVIOUS, previousUnknowns)
    Set currentItems = BuildParsedDictionary(SHEET_CURRENT, currentUnknowns)
    Set baseLookup = BuildBaseLookup(currentItems)
    Set resultsWs = GetRequiredSheet(SHEET_RESULTS)

    ClearWorkingArea resultsWs, RESULTS_FIRST_ROW, 1, 7
    FormatResultsTable resultsWs
    rowNumber = RESULTS_FIRST_ROW

    For Each key In previousItems.Keys
        Set previousItem = previousItems(key)
        If currentItems.Exists(key) Then
            Set currentItem = currentItems(key)
            WriteResultRow resultsWs, rowNumber, "Match", key, previousItem("Raw"), currentItem("Raw"), _
                           PreferredDescription(previousItem, currentItem), previousItem("Edition"), "Exact form and edition match."
            rowNumber = rowNumber + 1
        ElseIf baseLookup.Exists(previousItem("BaseCode")) Then
            currentBase = CStr(baseLookup(previousItem("BaseCode")))
            Set currentItem = currentItems(currentBase)
            WriteResultRow resultsWs, rowNumber, "Edition Changed", previousItem("BaseCode"), previousItem("Raw"), currentItem("Raw"), _
                           PreferredDescription(previousItem, currentItem), _
                           FormatEdition(previousItem("Edition")) & " -> " & FormatEdition(currentItem("Edition")), _
                           "Same form number with a different edition."
            rowNumber = rowNumber + 1
        Else
            WriteResultRow resultsWs, rowNumber, "Removed", key, previousItem("Raw"), vbNullString, _
                           previousItem("Description"), previousItem("Edition"), "Present in Previous only."
            rowNumber = rowNumber + 1
        End If
    Next key

    For Each key In currentItems.Keys
        If Not previousItems.Exists(key) Then
            Set currentItem = currentItems(key)
            If Not WasEditionChange(previousItems, currentItem("BaseCode")) Then
                WriteResultRow resultsWs, rowNumber, "Added", key, vbNullString, currentItem("Raw"), _
                               currentItem("Description"), currentItem("Edition"), "Present in Current only."
                rowNumber = rowNumber + 1
            End If
        End If
    Next key

    rowNumber = WriteUnknownRows(resultsWs, rowNumber, previousUnknowns, "Previous")
    rowNumber = WriteUnknownRows(resultsWs, rowNumber, currentUnknowns, "Current")

    If rowNumber > RESULTS_FIRST_ROW Then
        resultsWs.Range("A5:G" & rowNumber - 1).Borders.Color = RGB(226, 232, 240)
    End If

    RefreshDashboard
    SetLastCompared Timer - startTime
    Application.StatusBar = "Policy comparison complete."
End Sub

' Builds a dictionary of parsed known forms from an input sheet.
Public Function BuildParsedDictionary(ByVal sheetName As String, ByRef unknownItems As Collection) As Object
    Dim ws As Worksheet
    Dim items As Object
    Dim lastRow As Long
    Dim rowNumber As Long
    Dim parsed As Object
    Dim rawLine As String
    Dim key As String

    Set ws = GetRequiredSheet(sheetName)
    Set items = NewDictionary()
    Set unknownItems = New Collection

    lastRow = LastUsedRowInColumn(ws, RAW_COLUMN, FIRST_INPUT_ROW)
    For rowNumber = FIRST_INPUT_ROW To lastRow
        rawLine = NzText(ws.Cells(rowNumber, RAW_COLUMN).Value)
        If Len(CleanText(rawLine)) > 0 Then
            Set parsed = ParseFormLine(rawLine)
            If Len(parsed("NormalizedCode")) > 0 And parsed("Known") Then
                key = parsed("NormalizedCode")
                If Not items.Exists(key) Then
                    items.Add key, parsed
                Else
                    items(key)("Raw") = items(key)("Raw") & " | duplicate: " & parsed("Raw")
                End If
            Else
                unknownItems.Add parsed
            End If
        End If
    Next rowNumber

    Set BuildParsedDictionary = items
End Function

' Builds a lookup from base form code to full normalized current code.
Private Function BuildBaseLookup(ByVal items As Object) As Object
    Dim lookup As Object
    Dim key As Variant
    Dim item As Object

    Set lookup = NewDictionary()
    For Each key In items.Keys
        Set item = items(key)
        If Len(item("BaseCode")) > 0 Then
            If Not lookup.Exists(item("BaseCode")) Then lookup.Add item("BaseCode"), CStr(key)
        End If
    Next key
    Set BuildBaseLookup = lookup
End Function

' Returns True when a current base code was already emitted as an edition change.
Private Function WasEditionChange(ByVal previousItems As Object, ByVal baseCode As String) As Boolean
    Dim key As Variant
    For Each key In previousItems.Keys
        If previousItems(key)("BaseCode") = baseCode Then
            WasEditionChange = True
            Exit Function
        End If
    Next key
End Function

' Chooses the most useful description from two parsed records.
Private Function PreferredDescription(ByVal previousItem As Object, ByVal currentItem As Object) As String
    If Len(currentItem("Description")) > 0 Then
        PreferredDescription = currentItem("Description")
    Else
        PreferredDescription = previousItem("Description")
    End If
End Function

' Writes a single comparison row to Results.
Private Sub WriteResultRow(ByVal ws As Worksheet, ByVal rowNumber As Long, ByVal statusText As String, _
                           ByVal normalizedCode As String, ByVal originalPrevious As String, ByVal originalCurrent As String, _
                           ByVal description As String, ByVal edition As String, ByVal notes As String)
    ws.Cells(rowNumber, 1).Value = statusText
    ws.Cells(rowNumber, 2).Value = IIf(Len(normalizedCode) >= 6, DisplayFormCode(normalizedCode), normalizedCode)
    ws.Cells(rowNumber, 3).Value = originalPrevious
    ws.Cells(rowNumber, 4).Value = originalCurrent
    ws.Cells(rowNumber, 5).Value = description
    ws.Cells(rowNumber, 6).Value = FormatEdition(edition)
    ws.Cells(rowNumber, 7).Value = notes
    ApplyStatusFormat ws.Range("A" & rowNumber & ":G" & rowNumber), statusText
End Sub

' Appends unknown-format records to Results.
Private Function WriteUnknownRows(ByVal ws As Worksheet, ByVal startRow As Long, ByVal unknownItems As Collection, ByVal sourceName As String) As Long
    Dim item As Object
    Dim rowNumber As Long

    rowNumber = startRow
    For Each item In unknownItems
        WriteResultRow ws, rowNumber, "Unknown Format", item("Clean"), _
                       IIf(sourceName = "Previous", item("Raw"), vbNullString), _
                       IIf(sourceName = "Current", item("Raw"), vbNullString), _
                       item("Description"), item("Edition"), "Review raw " & sourceName & " input."
        rowNumber = rowNumber + 1
    Next item

    WriteUnknownRows = rowNumber
End Function
