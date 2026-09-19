param([string]$ScoopRoot, [string]$ManifestPath)
$ErrorActionPreference='Stop'
. "$ScoopRoot/lib/install.ps1"
$script:nativeManifest=Get-Content -Raw $ManifestPath | ConvertFrom-Json
function Get-Manifest($app) { return @('fixture',$script:nativeManifest,'review',$null) }
function Get-SupportedArchitecture($manifest,$arch) { return $arch }
function get_config($name,$default) { return $default }
function ensure($path) { return $path }
function versiondir($app,$version,$global) { return '/tmp/uncreated-review-version' }
function persistdir($app,$global) { return '/tmp/uncreated-review-persist' }
function warn($message) {}
function Invoke-ScoopDownload($app,$version,$manifest,$bucket,$arch,$dir,$cache,$check_hash) { $script:captured=$check_hash; throw 'STOP_BEFORE_DOWNLOAD' }
try { install_app 'fixture' '64bit' $false } catch { if ($_.Exception.Message -ne 'STOP_BEFORE_DOWNLOAD') { throw } }
@{inputVersion=$script:nativeManifest.version;nativeCheckHash=$script:captured} | ConvertTo-Json -Compress
