param([string]$ScoopRoot, [string]$ManifestPath, [string]$FixtureDirectory, [switch]$Wildcard)
$ErrorActionPreference='Stop'
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile("$ScoopRoot/lib/core.ps1",[ref]$tokens,[ref]$errors)
foreach($name in @('shim','fname','strip_ext','substitute')) {
 $node=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
 . ([ScriptBlock]::Create($node.Extent.Text))
}
. "$ScoopRoot/lib/install.ps1"
. "$ScoopRoot/lib/manifest.ps1"
$script:directory=$FixtureDirectory
$manifest=Get-Content -Raw $ManifestPath | ConvertFrom-Json
$path=Join-Path $script:directory $(if ($Wildcard) { 'bin/tool1.exe' } else { $manifest.bin })
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
[System.IO.File]::WriteAllText($path,'Write-Output ORIGINAL_EXECUTABLE')
function shimdir($global) { return "$script:directory/shims" }
function ensure($path) { [System.IO.Directory]::CreateDirectory($path) | Out-Null; return $path }
function Add-Path($Path,[switch]$Global) {}
function warn_on_overwrite($shim,$path) {}
function abort($message) { throw $message }
$script:output=@{}
function Out-UTF8File { param([string]$FilePath,[switch]$Append,[switch]$NoNewLine,[Parameter(ValueFromPipeline=$true)]$InputObject) process { $script:output[$FilePath]=$InputObject } }
function Copy-Item($Path,$Destination,[switch]$Force) {}
function get_shim_path { return '/tmp/not-used-native-shim-binary' }
function Get-PESubsystem($path) { return -1 }
create_shims $manifest $script:directory $false '64bit'
if ($Wildcard) {
    @{requested=$manifest.bin;outputs=$script:output} | ConvertTo-Json -Depth 4 -Compress
} else {
    $generated=@($script:output.GetEnumerator() | Where-Object {$_.Key.EndsWith('.ps1')})[0].Value
    $global:CatalogProbe='UNCHANGED'
    try { & ([ScriptBlock]::Create($generated)) } catch { }
    @{nativeGeneratedScript=$generated;probe=$global:CatalogProbe} | ConvertTo-Json -Compress
}
