# Xodus Nexus backend 0.2.11

- Accept compact JWE tickets when requesting game content licenses, while preserving existing Xbox and Store sign-in handling.
- Preserve Microsoft broker headers through both hosted sign-in steps, addressing sign-in stuck on **Please wait**. Thanks @Wyze3306 for the upstream fix adapted here.
- Fix bundle-resolution loops and resolve game editions and add-ons from declared bundle contents rather than unrelated licensing references. Thanks @skeltavik for the contribution.
- Report clearer errors when Store bundle metadata is unavailable.
