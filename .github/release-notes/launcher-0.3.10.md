# Xodus Nexus 0.3.10

This is another technical update focused on fixing system-keyring and sign-in problems, especially in SteamOS and Bazzite Game Mode.

The changes were tested on two clean VM installations running current versions of **SteamOS** and **Bazzite Deck**. Physical handheld testing is still needed, so please report any remaining issues.

- Automatically start supported KDE wallets in Game Mode and display their native unlock dialogs, including for password-protected wallets.
- Improve keyring detection and provide clearer account-service errors.
- Add **Create wallet** in setup and account Settings when no wallet collection exists.
- Improve saved-account persistence when switching between Desktop Mode and Game Mode or shutting down.

Update the Nexus backend to **0.2.10** in Settings for these changes and the accompanying interrupted-installation repair.

## Wallet setup and unlocking

- If the service is stopped, use **Start service**. Supported KDE wallets should also start automatically when Nexus opens in Game Mode.
- If your wallet has a password, its native unlock window may appear. Enter your **wallet password**, which is not necessarily your Microsoft account password. Nexus does not receive this password.
- A wallet without a password should unlock without requiring password entry.
- If no wallet exists, use **Create wallet** and complete the system dialog. On KDE, choose **Classic, blowfish encrypted file** for a normal password-based wallet if you do not have a GPG encryption key. An empty password does not protect stored credentials.
- If setup or the password dialog does not work in Game Mode, try it in Desktop Mode first. If the problem persists, include the backend diagnostic log in your issue report.

Nexus does not change existing wallet passwords, enable wallets you disabled or reset stored credentials.

> [!CAUTION]
> **Xodus Nexus is an independent, unofficial project built on Xodus. It is not an official project or release from the upstream Xodus developers.**
>
> Please report Xodus Nexus issues only in the [Xodus Nexus repository](https://github.com/domsvoboda/xodus-nexus/issues). A problem in Nexus does not necessarily indicate a problem in upstream Xodus.

## Steam Deck and similar handhelds

Steam Deck and similar handheld support is experimental. I'm currently testing and debugging on virtualized SteamOS and Bazzite, so I can't fully verify how everything behaves on real handheld hardware. Please report any issues you encounter.

I'm looking to buy an older Steam Deck or a similar handheld compatible with Bazzite or SteamOS for development and testing. If you have one you'd be willing to sell, please message me on Reddit at [u/Embarrassed-Hall-617](https://www.reddit.com/user/Embarrassed-Hall-617/). Cosmetic damage and signs of wear don't matter, as long as the device's basic functions work.
