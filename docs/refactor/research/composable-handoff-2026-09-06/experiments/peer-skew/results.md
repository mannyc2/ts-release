# Installer behavior under peer and dependency skew

Runtimes: node v22.22.2, npm 10.9.7, bun 1.3.14. Synthetic packages served by a loopback registry (`registry.mjs` copied from the lab); no Effect code, no network. Reproduce with `bun run.mjs <work-dir>`.

| Scenario | Installer | Exit | Installed (nested = second copy) | Runtime probe | Diagnostic |
| --- | --- | ---: | --- | --- | --- |
| S1-effect-exact-peer-consumer-rc109 | npm | 1 | — | `—` | npm error code ERESOLVE / npm error ERESOLVE unable to resolve dependency tree |
| S1-effect-exact-peer-consumer-rc109 | bun | 0 | fake-effect@4.0.0-rc.109, kernel-exactpeer@1.0.0 | `{"kernelSeesEffect": "4.0.0-rc.109"}` | + kernel-exactpeer@1.0.0 |
| S2-effect-range-peer-consumer-rc109 | npm | 0 | fake-effect@4.0.0-rc.109, kernel-rangepeer@1.0.0 | `{"kernelSeesEffect": "4.0.0-rc.109"}` | — |
| S2-effect-range-peer-consumer-rc109 | bun | 0 | fake-effect@4.0.0-rc.109, kernel-rangepeer@1.0.0 | `{"kernelSeesEffect": "4.0.0-rc.109"}` | + kernel-rangepeer@1.0.0 |
| S3-provider-dependencies-exact-kernel-skew | npm | 0 | kernel@2.0.0, provider-depexact@1.0.0, kernel@1.0.0 (nested) | `{"rootKernel": "2.0.0", "providerKernel": "1.0.0", "sameInstance": false, "kernelInstancesLoaded": 2}` | — |
| S3-provider-dependencies-exact-kernel-skew | bun | 0 | kernel@2.0.0, provider-depexact@1.0.0, kernel@1.0.0 (nested) | `{"rootKernel": "2.0.0", "providerKernel": "1.0.0", "sameInstance": false, "kernelInstancesLoaded": 2}` | — |
| S4-provider-peer-exact-kernel-skew | npm | 1 | — | `—` | npm error code ERESOLVE / npm error ERESOLVE unable to resolve dependency tree |
| S4-provider-peer-exact-kernel-skew | bun | 0 | kernel@2.0.0, provider-peerexact@1.0.0 | `{"rootKernel": "2.0.0", "providerKernel": "2.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | + provider-peerexact@1.0.0 |
| S5-provider-peer-caret-kernel-1.5 | npm | 0 | kernel@1.5.0, provider-peercaret@1.0.0 | `{"rootKernel": "1.5.0", "providerKernel": "1.5.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | — |
| S5-provider-peer-caret-kernel-1.5 | bun | 0 | kernel@1.5.0, provider-peercaret@1.0.0 | `{"rootKernel": "1.5.0", "providerKernel": "1.5.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | + provider-peercaret@1.0.0 |
| S6-provider-peer-caret-kernel-2.0 | npm | 1 | — | `—` | npm error code ERESOLVE / npm error ERESOLVE unable to resolve dependency tree |
| S6-provider-peer-caret-kernel-2.0 | bun | 0 | kernel@2.0.0, provider-peercaret@1.0.0 | `{"rootKernel": "2.0.0", "providerKernel": "2.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | + provider-peercaret@1.0.0 |
| S7-provider-peer-exact-kernel-match | npm | 0 | kernel@1.0.0, provider-peerexact@1.0.0 | `{"rootKernel": "1.0.0", "providerKernel": "1.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | — |
| S7-provider-peer-exact-kernel-match | bun | 0 | kernel@1.0.0, provider-peerexact@1.0.0 | `{"rootKernel": "1.0.0", "providerKernel": "1.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | + provider-peerexact@1.0.0 |
| S8-provider-dependencies-exact-with-consumer-override | npm | 0 | kernel@2.0.0, provider-depexact@1.0.0 | `{"rootKernel": "2.0.0", "providerKernel": "2.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | — |
| S8-provider-dependencies-exact-with-consumer-override | bun | 0 | kernel@2.0.0, provider-depexact@1.0.0 | `{"rootKernel": "2.0.0", "providerKernel": "2.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | — |
| S9-provider-peer-exact-consumer-omits-kernel | npm | 0 | kernel@1.0.0, provider-peerexact@1.0.0 | `{"rootKernel": "1.0.0", "providerKernel": "1.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | — |
| S9-provider-peer-exact-consumer-omits-kernel | bun | 0 | kernel@1.0.0, provider-peerexact@1.0.0 | `{"rootKernel": "1.0.0", "providerKernel": "1.0.0", "sameInstance": true, "kernelInstancesLoaded": 1}` | + provider-peerexact@1.0.0 |

## Questions

- **S1-effect-exact-peer-consumer-rc109**: kernel pins effect as an EXACT peer; consumer resolves effect rc.109 (what effect-build 0.6.3's range allows)
- **S2-effect-range-peer-consumer-rc109**: kernel declares effect as a RANGE peer (tracked law scripts/lib/versions.ts:49); consumer resolves rc.109
- **S3-provider-dependencies-exact-kernel-skew**: provider lists kernel@1.0.0 in dependencies (as layout.json projects); consumer installs kernel@2.0.0
- **S4-provider-peer-exact-kernel-skew**: provider lists kernel@1.0.0 as an EXACT peer (audit D4); consumer installs kernel@2.0.0
- **S5-provider-peer-caret-kernel-1.5**: provider peer ^1.0.0; consumer installs kernel@1.5.0 (in range)
- **S6-provider-peer-caret-kernel-2.0**: provider peer ^1.0.0; consumer installs kernel@2.0.0 (out of range)
- **S7-provider-peer-exact-kernel-match**: control: exact peer satisfied
- **S8-provider-dependencies-exact-with-consumer-override**: S3 plus a consumer-side override forcing one kernel (npm overrides / bun overrides)
- **S9-provider-peer-exact-consumer-omits-kernel**: consumer installs only the provider; does the installer auto-install the exact kernel peer?
