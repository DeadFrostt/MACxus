# MACxus patched runtime DLLs

PE builds of the Xodus Nexus runtime release `xodus-nexus-runtime-11.0-20261022-gf4adc821`
(Wine 11.0 sources, LGPL-2.1-or-later) with the macOS patches in `assets/runtime-patches`:

| DLL | Patches |
| --- | --- |
| `xgameruntime.dll` | `wine-macos-gs-last-error.patch`, `xgameruntime-xstore-queries.patch` |
| `windows.web.dll`, `twinapi.appcore.dll`, `gamingtcui.dll`, `winhttp.dll` | `wine-macos-gs-last-error.patch` |

The launcher installs them only on that runtime release (see `manifest.json`). A DLL placed in
`~/Library/Application Support/MACxus/runtime-overrides` takes precedence.

Rebuild: apply the patches to the runtime's Wine tree, `configure` for PE only, then
`make dlls/<name>/x86_64-windows/<name>.dll` (needs `x86_64-w64-mingw32-gcc` and Homebrew bison
on `PATH`).
