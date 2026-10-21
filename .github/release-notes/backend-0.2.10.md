# Xodus Nexus backend 0.2.10

- Add native wallet unlocking and first-wallet setup for the launcher's Game Mode and keyring controls. Wallet passwords stay in the system dialog.
- Improve KWallet credential persistence during session changes and shutdown.
- Preserve complete encrypted executable files when resuming interrupted installations. Repair can recover files trimmed by an earlier resume without reinstalling the entire game.
- Replace launch-image panics with actionable errors identifying incomplete or unreadable files.
