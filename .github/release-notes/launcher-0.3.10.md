# Xodus Nexus 0.3.10

This hotfix focuses on system-keyring and sign-in problems in SteamOS and Bazzite Game Mode.

- Automatically start the supported KDE wallet in Game Mode and display its native unlock dialog, including for password-protected wallets.
- Improve keyring detection and show clearer account-service errors without changing wallet security settings.
- Add Create wallet in setup and account Settings when no wallet collection exists. Choose its password in the system dialog, not in Nexus.
- Improve saved-account persistence when switching between Desktop Mode and Game Mode or shutting down.

Update the Nexus backend to **0.2.10** in Settings for these changes and the accompanying interrupted-installation repair.

> [!CAUTION]
> **Xodus Nexus is an independent, unofficial project built on Xodus. It is not an official project or release from the upstream Xodus developers.**
>
> Please report Xodus Nexus issues only in the [Xodus Nexus repository](https://github.com/domsvoboda/xodus-nexus/issues). A problem in Nexus does not necessarily indicate a problem in upstream Xodus.

## Steam Deck and similar handhelds

Steam Deck and similar handheld support is experimental. I'm currently testing and debugging on virtualized SteamOS and Bazzite, so I can't fully verify how everything behaves on real handheld hardware. Please report any issues you encounter.

I'm looking to buy an older Steam Deck or a similar handheld compatible with Bazzite or SteamOS for development and testing. If you have one you'd be willing to sell, please message me on Reddit at [u/Embarrassed-Hall-617](https://www.reddit.com/user/Embarrassed-Hall-617/). Cosmetic damage and signs of wear don't matter, as long as the device's basic functions work.
