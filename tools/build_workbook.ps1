$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$workbookPath = Join-Path $projectRoot "Insurance Forms Comparator.xlsm"
$vbaPath = Join-Path $projectRoot "VBA"
$logPath = Join-Path $projectRoot "build.log"

function Log($message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
    Add-Content -LiteralPath $logPath -Value $line
    Write-Host $line
}

Set-Content -LiteralPath $logPath -Value "Insurance Forms Comparator build log"
if (Test-Path $workbookPath) { Remove-Item -LiteralPath $workbookPath -Force }

Log "Starting Excel"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    Log "Creating workbook"
    $excel.SheetsInNewWorkbook = 6
    $wb = $excel.Workbooks.Add()
    Log "Workbook created with sheets"

    $homeWs = $wb.Worksheets.Item(1)
    $previous = $wb.Worksheets.Item(2)
    $current = $wb.Worksheets.Item(3)
    $results = $wb.Worksheets.Item(4)
    $dashboard = $wb.Worksheets.Item(5)
    $settings = $wb.Worksheets.Item(6)

    $homeWs.Name = "Home"
    $previous.Name = "Previous"
    $current.Name = "Current"
    $results.Name = "Results"
    $dashboard.Name = "Dashboard"
    $settings.Name = "Settings"

    Log "Home"
    $homeWs.Range("A1").Value2 = "Insurance Forms & Endorsements Comparator"
    $homeWs.Range("A1").Font.Bold = $true
    $homeWs.Range("A1").Font.Size = 20
    $homeWs.Range("A2").Value2 = "Offline VBA workbook for comparing Previous and Current insurance policy schedules"
    $homeWs.Range("A4").Value2 = "Workflow"
    $homeWs.Range("A4").Font.Bold = $true
    $homeWs.Range("A5").Value2 = "1. Paste raw text into Previous and Current." + [Environment]::NewLine + "2. Click Clean Previous and Clean Current to preview parsed form codes." + [Environment]::NewLine + "3. Correct OCR issues in the raw paste area if needed." + [Environment]::NewLine + "4. Click Compare Policies." + [Environment]::NewLine + "5. Export Results when ready."
    $homeWs.Range("A5").WrapText = $true
    $homeWs.Range("A12").Value2 = "Version"
    $homeWs.Range("B12").Value2 = "1.0.0"
    $homeWs.Range("A13").Value2 = "Developer"
    $homeWs.Range("B13").Value2 = "Codex"
    $homeWs.Columns("A").ColumnWidth = 85
    $homeWs.Columns("B:G").ColumnWidth = 18

    $buttonData = @(
        @("Clean Previous", "CleanPrevious", 20, 245, 140, 28),
        @("Clean Current", "CleanCurrent", 175, 245, 140, 28),
        @("Compare Policies", "ComparePolicies", 330, 245, 155, 28),
        @("Export Results", "ExportComparison", 500, 245, 140, 28),
        @("Clear Everything", "ClearWorkbook", 20, 285, 140, 28),
        @("Settings", "OpenSettings", 175, 285, 140, 28)
    )
    foreach ($buttonInfo in $buttonData) {
        $button = $homeWs.Buttons().Add($buttonInfo[2], $buttonInfo[3], $buttonInfo[4], $buttonInfo[5])
        $button.Caption = $buttonInfo[0]
        $button.OnAction = $buttonInfo[1]
    }

    Log "Previous and Current"
    foreach ($pair in @(@($previous, "Previous"), @($current, "Current"))) {
        $ws = $pair[0]
        $label = $pair[1]
        $ws.Range("A1").Value2 = "Paste $label Policy Forms Here"
        $ws.Range("A1").Font.Bold = $true
        $ws.Range("A1").Font.Size = 18
        $ws.Range("A2").Value2 = "Paste copied text in column A starting at row 6, then use Clean & Preview."
        $ws.Range("A5").Value2 = "Raw Pasted Schedule"
        $ws.Range("C5").Value2 = "Status"
        $ws.Range("D5").Value2 = "Normalized Code"
        $ws.Range("E5").Value2 = "Display Code"
        $ws.Range("F5").Value2 = "Edition"
        $ws.Range("G5").Value2 = "Description"
        $ws.Range("A5:G5").Font.Bold = $true
        $ws.Columns("A").ColumnWidth = 74
        $ws.Columns("C:F").ColumnWidth = 22
        $ws.Columns("G").ColumnWidth = 54
        $ws.Range("A6:G5000").WrapText = $true
    }

    $prevSample = Get-Content -LiteralPath (Join-Path $projectRoot "samples\Previous Sample.txt")
    $curSample = Get-Content -LiteralPath (Join-Path $projectRoot "samples\Current Sample.txt")
    for ($i = 0; $i -lt $prevSample.Count; $i++) { $previous.Cells.Item(6 + $i, 1).Value2 = $prevSample[$i] }
    for ($i = 0; $i -lt $curSample.Count; $i++) { $current.Cells.Item(6 + $i, 1).Value2 = $curSample[$i] }

    Log "Results"
    $results.Range("A1").Value2 = "Comparison Results"
    $results.Range("A1").Font.Bold = $true
    $results.Range("A1").Font.Size = 18
    $headers = @("Status", "Normalized Code", "Original Previous", "Original Current", "Description", "Edition", "Notes")
    for ($i = 0; $i -lt $headers.Count; $i++) {
        $results.Cells.Item(5, 1 + $i).Value2 = $headers[$i]
        $results.Cells.Item(5, 1 + $i).Font.Bold = $true
    }
    $results.Columns("A").ColumnWidth = 20
    $results.Columns("B").ColumnWidth = 22
    $results.Columns("C:D").ColumnWidth = 48
    $results.Columns("E").ColumnWidth = 54
    $results.Columns("F").ColumnWidth = 14
    $results.Columns("G").ColumnWidth = 34
    $results.Range("A6:G5000").WrapText = $true

    Log "Dashboard"
    $dashboard.Range("A1").Value2 = "Dashboard"
    $dashboard.Range("A1").Font.Bold = $true
    $dashboard.Range("A1").Font.Size = 18
    $summary = @("Previous Count", "Current Count", "Matches", "Added", "Removed", "Edition Changed", "Unknown", "Completion %")
    for ($i = 0; $i -lt $summary.Count; $i++) {
        $dashboard.Cells.Item(4 + $i, 1).Value2 = $summary[$i]
        $dashboard.Cells.Item(4 + $i, 2).Value2 = 0
        $dashboard.Cells.Item(4 + $i, 1).Font.Bold = $true
    }
    $dashboard.Range("B11").NumberFormat = "0%"
    $dashboard.Range("A17").Value2 = "Last Compared"
    $dashboard.Range("A18").Value2 = "Comparison Time"
    $dashboard.Range("E3").Value2 = "Status"
    $dashboard.Range("F3").Value2 = "Count"
    $chartRows = @("Match", "Added", "Removed", "Edition Changed", "Unknown")
    for ($i = 0; $i -lt $chartRows.Count; $i++) {
        $dashboard.Cells.Item(4 + $i, 5).Value2 = $chartRows[$i]
        $dashboard.Cells.Item(4 + $i, 6).Value2 = 0
    }
    $dashboard.Columns("A:F").ColumnWidth = 20
    $pie = $dashboard.ChartObjects().Add(340, 70, 320, 220)
    $pie.Chart.ChartType = 5
    $pie.Chart.SetSourceData($dashboard.Range("E3:F8"))
    $pie.Chart.HasTitle = $true
    $pie.Chart.ChartTitle.Text = "Outcome Mix"
    $bar = $dashboard.ChartObjects().Add(340, 320, 320, 220)
    $bar.Chart.ChartType = 51
    $bar.Chart.SetSourceData($dashboard.Range("E3:F8"))
    $bar.Chart.HasTitle = $true
    $bar.Chart.ChartTitle.Text = "Comparison Counts"

    Log "Settings"
    $settings.Range("A1").Value2 = "Known Prefix"
    $prefixes = @("CG", "IL", "CA", "WC", "BP", "CP", "IM", "CU")
    for ($i = 0; $i -lt $prefixes.Count; $i++) { $settings.Cells.Item(2 + $i, 1).Value2 = $prefixes[$i] }
    $settings.Range("C1").Value2 = "Status"
    $settings.Range("D1").Value2 = "Color"
    $statuses = @(@("Match", "Green"), @("Added", "Yellow"), @("Removed", "Red"), @("Edition Changed", "Orange"), @("Unknown Format", "Gray"))
    for ($i = 0; $i -lt $statuses.Count; $i++) {
        $settings.Cells.Item(2 + $i, 3).Value2 = $statuses[$i][0]
        $settings.Cells.Item(2 + $i, 4).Value2 = $statuses[$i][1]
    }
    $settings.Range("F1").Value2 = "Workbook Version"
    $settings.Range("G1").Value2 = "1.0.0"
    $settings.Range("F2").Value2 = "Developer"
    $settings.Range("G2").Value2 = "Codex"
    $settings.Visible = 2

    Log "Importing VBA"
    foreach ($moduleFile in @("modUtilities.bas", "modFormatter.bas", "modParser.bas", "modCompare.bas", "modDashboard.bas", "modExport.bas", "modMain.bas")) {
        $fullPath = Join-Path $vbaPath $moduleFile
        Log "Import $moduleFile"
        [void]$wb.VBProject.VBComponents.Import($fullPath)
    }

    Log "Saving"
    $homeWs.Activate() | Out-Null
    $wb.SaveAs($workbookPath, 52)
    Log "Saved $workbookPath"
}
finally {
    if ($null -ne $wb) { $wb.Close($true) }
    if ($null -ne $excel) {
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
