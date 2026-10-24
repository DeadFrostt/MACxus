# macOS test baseline

Recorded on branch `macos` (created from a5827f9) before any macOS changes.

- **Date:** 2026-10-24
- **Node:** v22.23.2
- **npm:** 10.9.8
- **Platform:** darwin (macOS, Darwin 27.2.0)

## `npm test` (vitest run)

- Test files: 14 failed | 82 passed (96)
- Tests: 83 failed | 917 passed (1000)

### Failing test files and reasons

Reasons are from the vitest output. Most failures are Linux-only guards, Linux-specific fixtures or assumptions, or macOS path behaviour (`/var` is a symlink to `/private/var`, and the default filesystem is case-insensitive).

- `src/main/auth-browser-launch.test.ts` (10): "Browser sign-in is currently supported on Linux with Google Chrome" (Linux-only guard).
- `src/main/backend.test.ts` (1): "The prebuilt backend currently supports x86_64 Linux only."
- `src/main/desktop-open.test.ts` (3): expects the Linux `xdg-open` opener call and behaviour.
- `src/main/download-cleanup.test.ts` (11): Linux filesystem fixtures; ENOENT on fixture rename/open and unexpected "Only a new installation folder..." errors.
- `src/main/game-delete.test.ts` (10): "The game location contains a symbolic link." (macOS `/var` symlink in fixture paths).
- `src/main/game-process.test.ts` (2): fixture launch script (`launch-game`) fails to run as a command.
- `src/main/game-removal.test.ts` (3): "The game location contains a symbolic link." (macOS `/var` symlink in fixture paths).
- `src/main/game-shortcuts.test.ts` (2): fixture `launch-game` shortcut script fails to execute.
- `src/main/install-integration.test.ts` (5): ENOENT on fixture download paths; unexpected installation-folder errors.
- `src/main/install-queue.test.ts` (2): symlinked-ancestor assertions; `/private/var/...` vs `/var/...` realpath mismatch.
- `src/main/launcher-bootstrap.test.ts` (31): packaged Linux launcher script fails under macOS shell ("syntax error near unexpected token `;;'" at line 14 in the temp launcher); Linux IME/overlay expectations.
- `src/main/launcher-environment.test.ts` (1): expected IME `'Steam'`, got `'simple'` (Linux input-method logic).
- `src/main/steam-shortcuts.test.ts` (1): "Steam integration is currently supported on Linux only."
- `src/main/windows-path.test.ts` (1): expected `'Game.exe'` to be undefined for `game.exe` (case-insensitive APFS resolves the name).

### Failing test names

<details>
<summary>All 83 failing tests</summary>

- auth-browser-launch: allows executable native Chrome on an absolute PATH only; bounds lookup failures and reports missing Chrome accurately; does not execute a missing or nonexecutable Flatpak; falls back to the system installation without installing anything; finds a user-installed Chrome by exact Flatpak ref; prefers native Chrome without starting Flatpak; rejects an unexpected app or untrusted ref (4 cases)
- backend: verifies install and preserves the old pointer on failure: valid
- desktop-open: opens a literal target with the original IME (2 cases); surfaces opener failure without trying a second potentially duplicate launch
- download-cleanup: deletes only its proven new folder, preserving existing games and saves alongside it; does not trust a changed / missing / symlink ownership marker; never overwrites a replacement at the original path when cleanup fails; preserves a new folder containing an unsafe link; refuses symlinked private proof and ownership directories; rejects same-device bind mounts before deleting any files; reports partial cleanup and restores remaining files; retains proof across launcher restarts but never trusts task flags; revalidates the atomically moved directory before deletion
- game-delete: permanently deletes only the validated game folder; rejects a directory / symlink masquerading as the game manifest; rejects directory, file, symlink and missing replacement after validation; rejects an ancestor replaced by a symbolic link; rejects overlapping parent games and aliases; reports partial failure honestly
- game-process: stops the game process group without signalling unrelated processes; force-stops through the exact prefix control and kills a signal-resistant group
- game-removal: accepts an isolated game directory with a manifest; rejects a directory containing another game; rejects a protected directory and a missing manifest
- game-shortcuts: creates Steam launch descriptions without unwanted desktop/menu entries; creates profile-scoped desktop/menu entries and starts the launcher
- install-integration: keeps new partials by default and refuses deletion of an existing folder or an update; offers cleanup only for a new folder and waits for process exit; passes all native profiles to Steam-owned live import; removes only unrelated games while downloading; runs real queue IPC, pause/cancel/failure/restart
- install-queue: resolves symlinked ancestors before protecting new paths; reserves future paths behind dangling relative and chained symlinks
- launcher-bootstrap (31): see file-level reason above (IME, overlay, preload, Steam Game Mode and bootstrap-shell cases)
- launcher-environment: gives an actual tracked child the original input without the private marker
- steam-shortcuts: discovers existing native and Flatpak profiles, deduplicating Steam symlinks
- windows-path: prefers an exact name and refuses ambiguous fallbacks, traversal, directories and escaping symlinks

</details>

## `npm run typecheck`

Passed with no errors (`tsc --noEmit` and `tsc -p tsconfig.electron.json --noEmit`, exit 0).
