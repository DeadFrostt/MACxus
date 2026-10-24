# macOS test baseline

Recorded on branch `macos` (created from a5827f9) before any macOS changes.

- **Date:** 2026-10-24
- **Node:** v22.23.2
- **npm:** 10.9.8
- **Platform:** darwin (macOS, Darwin 27.2.0)

## Authoritative failure list

**`docs/macos-baseline-failures.txt` is the authoritative list** of failing tests: one line per test, `<test file> > <describe ancestors> > <test name>`, sorted, 83 lines, no duplicates. Test names are normalised so a multi-line title is one line.

Regenerate and diff against the baseline (run from the repo root; the output file lives in `$TMPDIR`):

```sh
J="${TMPDIR:-/tmp}/macxus-now.json"
npx vitest run --reporter=json --outputFile="$J"; node -e 'const fs=require("fs");const r=JSON.parse(fs.readFileSync(process.argv[1]));const L=[];for(const f of r.testResults){const rel=f.name.replace(process.cwd()+"/","");for(const a of f.assertionResults)if(a.status==="failed")L.push(rel+" > "+a.ancestorTitles.concat([a.title]).join(" > ").replace(/\s*\n\s*/g," "));if(f.status==="failed"&&!f.assertionResults.length)L.push(rel+" > <file-level failure>")}process.stdout.write(L.join("\n")+"\n")' "$J" | LC_ALL=C sort | diff docs/macos-baseline-failures.txt -
```

An empty diff means no change. Lines prefixed `>` are new failures; lines prefixed `<` are baseline failures that now pass.

## Totals (`npm test`, vitest run)

- Test files: 14 failed | 82 passed (96)
- Tests: 83 failed | 917 passed (1000)

These totals came from two text-reporter runs and one JSON-reporter run, which all agreed.

## Flaky tests (timing)

Some tests hit vitest's 5000 ms timeout (`Error: Test timed out in 5000ms.`) on some runs. In two extra JSON-reporter runs, these tests timed out and are **not** in the baseline list:

- `src/main/account-library.test.ts` (maps real failed child processes to safe session guidance...)
- `src/main/backend-diagnostics.test.ts` (records achievement command metadata...)
- `src/main/proton.test.ts` (keeps the prefix... and provisions every verified shared DXVK module...)
- `src/main/runtime.test.ts` (verifies a downloaded Nexus runtime... `stderr-warning` and `valid`)

If a diff shows one of these as a new failure, check the timeout before treating it as a regression. Conversely, `backend-diagnostics.test.ts > observes actual tracked CLI calls without capturing license JSON or paths` failed in one JSON run only. The text runs and the final JSON run did not show it.

## Per-file failure reasons (hypotheses)

These are reasoned from the failure messages and have not been verified by changing code.

- `auth-browser-launch.test.ts` (10): Linux-only guard ("Browser sign-in is currently supported on Linux with Google Chrome").
- `backend.test.ts` (1): prebuilt backend supports x86_64 Linux only.
- `desktop-open.test.ts` (3): expects Linux `xdg-open` opener behaviour.
- `download-cleanup.test.ts` (11): Linux filesystem fixtures; ENOENT on fixture paths and unexpected installation-folder errors.
- `game-delete.test.ts` (10) and `game-removal.test.ts` (3): "The game location contains a symbolic link." Hypothesis: fixture paths sit under `/var`, which is a symlink to `/private/var` on macOS.
- `game-process.test.ts` (2) and `game-shortcuts.test.ts` (2): fixture `launch-game` script fails to execute.
- `install-integration.test.ts` (5): ENOENT on fixture download paths; unexpected installation-folder errors.
- `install-queue.test.ts` (2): symlinked-ancestor realpath mismatch (`/private/var/...` vs `/var/...`).
- `launcher-bootstrap.test.ts` (31): Linux IME, overlay and preload expectations, and the packaged launcher shell script (see below).
- `launcher-environment.test.ts` (1): expected IME `'Steam'`, got `'simple'`. Linux input-method logic.
- `steam-shortcuts.test.ts` (1): "Steam integration is currently supported on Linux only."
- `windows-path.test.ts` (1): expected `game.exe` to be undefined. Hypothesis: case-insensitive APFS resolves the name.

**Unexplained:** the `launcher-bootstrap.test.ts` failures include the shell error `syntax error near unexpected token `;;'` at line 14 of the temp launcher script (`launcher with spaces and 'quote/xodus-nexus`). The cause has not been investigated. It is not confirmed to be a macOS-specific issue (it could be the `/bin/sh` version, the quoting in the path, or the test's own script).

## `npm run typecheck`

Passed with no errors (`tsc --noEmit` and `tsc -p tsconfig.electron.json --noEmit`, exit 0).
