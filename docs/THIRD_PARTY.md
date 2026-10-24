# Third-party notices (macOS)

## Highball engine — LGPL-2.1

MACxus can optionally download the Highball Wine engine
(<https://github.com/gauthierpiarrette/highball-engine>), a Wine build made from
the CrossOver 26.3 sources plus patches. It is licensed under the GNU Lesser
General Public License v2.1; its source code is available from that repository.
MACxus does not bundle or modify it: the pinned release
`engine-wine-11.0-20261014T003801Z-0024-app-packages-0023-spatial-mixer` is
downloaded on request, checked against a pinned size and SHA-256, and installed
under `<MACxus data>/engines/highball/`.

D3DMetal is not part of the Highball engine; MACxus uses the copy shipped with
the user's own CrossOver installation.

## highball-db — CC0

The per-game launch profiles in `assets/mac-profiles.json` (for example the
Forza Horizon 6 D3DMetal GPU identity and msync settings) come from the
highball-db recipes, dedicated to the public domain under CC0 1.0.
