param([string]$ScoopRoot, [string]$ManifestPath)
$ErrorActionPreference = 'Stop'
. "$ScoopRoot/lib/manifest.ps1"
$text = Get-Content -Raw $ManifestPath
if (!(Test-Json -Json $text -SchemaFile "$ScoopRoot/schema.json")) { throw 'Native Scoop schema rejected manifest' }
$manifest = ConvertFrom-Json $text
$cells = @('64bit', 'arm64') | ForEach-Object {
    @{ architecture = $_; url = (arch_specific 'url' $manifest $_); hash = (arch_specific 'hash' $manifest $_); bin = (arch_specific 'bin' $manifest $_) }
}
@{ powershell = $PSVersionTable.PSVersion.ToString(); cells = @($cells) } | ConvertTo-Json -Depth 5 -Compress
