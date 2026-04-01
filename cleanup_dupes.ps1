# Delete all iCloud/Finder numbered duplicate files
$pattern = '.*\s[2-9](\.[^.]+)?$'
$items = Get-ChildItem -Path . -Recurse | Where-Object { $_.Name -match $pattern }
Write-Host "Found $($items.Count) duplicate files to delete:"
foreach ($item in $items) {
    Write-Host "  Deleting: $($item.FullName)"
    Remove-Item -LiteralPath $item.FullName -Force -ErrorAction SilentlyContinue
}
Write-Host "Done."
