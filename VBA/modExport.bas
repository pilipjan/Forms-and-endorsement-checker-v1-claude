Attribute VB_Name = "modExport"
Option Explicit

' Exports the Results sheet to a timestamped workbook in the project folder.
Public Sub ExportComparisonCore()
    Dim resultsWs As Worksheet
    Dim exportWb As Workbook
    Dim exportPath As String
    Dim fileName As String

    Set resultsWs = GetRequiredSheet(SHEET_RESULTS)

    If Len(CleanText(resultsWs.Range("A6").Value)) = 0 Then
        MsgBox "There are no comparison results to export yet.", vbInformation, "Insurance Comparator"
        Exit Sub
    End If

    fileName = "Insurance Forms Comparison " & Format(Now, "yyyymmdd-hhnnss") & ".xlsx"
    exportPath = ThisWorkbook.Path & Application.PathSeparator & fileName

    resultsWs.Copy
    Set exportWb = ActiveWorkbook
    exportWb.Worksheets(1).Name = "Comparison Results"
    Application.DisplayAlerts = False
    exportWb.SaveAs Filename:=exportPath, FileFormat:=xlOpenXMLWorkbook
    exportWb.Close SaveChanges:=False
    Application.DisplayAlerts = True

    MsgBox "Exported results to:" & vbCrLf & exportPath, vbInformation, "Insurance Comparator"
End Sub
