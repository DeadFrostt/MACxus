# Xodus Nexus 0.3.11

This is another technical update focused on licensing, sign-in and the overall functionality of the launcher.

I'm aware of the growing number of reports about games not working, and I'd like to focus on game compatibility and those reported issues in the next update.

## What's changed

- Improve content-license requests for accounts using JWE tickets.
- Fix Microsoft sign-in getting stuck on **Please wait**.
- Improve bundle and edition resolution, including owned games missing from My Library.
- Keep owned games with unsupported packages visible with an **Unsupported** badge and installation disabled.
- Fully clear saved credentials and local device registration on **Sign out**. **Sign in again** keeps the existing device registration.
- Fix permissions that could prevent managed Proton prefixes from starting games.
- Support adding Nexus shortcuts to large Steam libraries without changing existing entries.
- Add an editable diagnostic report with versions, system information and selected logs, with automatic redaction and local saving. Review the report before sharing it.

Update the Nexus backend to **0.2.11** and install the new Nexus runtime in Settings for the accompanying licensing, bundle-resolution, audio and cloud-save fixes.

Thanks to @skeltavik for the bundle-resolution contribution and @Wyze3306 for the upstream sign-in fix adapted here.

> [!CAUTION]
> **Xodus Nexus is an independent, unofficial project built on Xodus. It is not an official project or release from the upstream Xodus developers.**
>
> Please report Xodus Nexus issues only in the [Xodus Nexus repository](https://github.com/domsvoboda/xodus-nexus/issues). A problem in Nexus does not necessarily indicate a problem in upstream Xodus.

## Steam Deck and similar handhelds

Steam Deck and similar handheld support is experimental. I'm currently testing and debugging on virtualized SteamOS and Bazzite, so I can't fully verify how everything behaves on real handheld hardware. Please report any issues you encounter.

I'm looking to buy an older Steam Deck or a similar handheld compatible with Bazzite or SteamOS for development and testing. If you have one you'd be willing to sell, please message me on Reddit at [u/Embarrassed-Hall-617](https://www.reddit.com/user/Embarrassed-Hall-617/). Cosmetic damage and signs of wear don't matter, as long as the device's basic functions work.
