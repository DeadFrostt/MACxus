# Nexus runtime: audio, package progress and cloud saves

- Implement communication audio endpoint queries and change notifications requested by games such as Deep Rock Galactic.
- Correct installed-package byte totals and unknown-size reporting used by game progress queries.
- Preserve local saves when cloud transfers fail or conflict with pending local changes, and reject incomplete cloud metadata.
- Keep final save-upload notifications through session shutdown and report cloud-upload failures correctly.

Update the launcher to **0.3.11** and the backend to **0.2.11** in Settings. These fixes address specific runtime issues; they do not mean that all reported game-compatibility problems are resolved.
