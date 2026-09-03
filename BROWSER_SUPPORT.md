# Browser Support

Sprite Sheet Studio is designed as a modern, local-first browser application. The main editor has no mandatory backend and uses browser-native image, storage and worker APIs.

## Automated test targets

The Playwright smoke suite is configured for three browser engines:

| Playwright project | Browser family target | Status in repository |
| --- | --- | --- |
| `chromium` | Chromium-based desktop browsers | Configured |
| `firefox` | Firefox desktop | Configured |
| `webkit` | Safari/WebKit behavior | Configured |

Use:

```bash
npm run test:install
npm run test:smoke
```

Or run one engine:

```bash
npm run test:smoke:chromium
npm run test:smoke:firefox
npm run test:smoke:webkit
```

> **Important:** configuration is not the same thing as a verified pass. GitHub Actions are currently not producing workflow runs for this repository, so the matrix above intentionally says **Configured**, not **Passing**. A release should not change those labels until the suite has actually been executed for that release candidate.

## Runtime capabilities

The built-in **Diagnostics** dialog checks the capabilities that matter to the editor at runtime.

| Capability | Used for | Behavior when unavailable |
| --- | --- | --- |
| Canvas 2D | preview, slicing, transforms, exports | Editor cannot operate normally |
| `createImageBitmap` | decoding imported images | Import is considered unsupported |
| IndexedDB | local autosave / project restore | Persistent autosave unavailable |
| Web Workers | GIF/APNG background encoding | Heavy export may be unavailable or use fallback where implemented |
| `CompressionStream` | APNG compression | APNG exporter uses its compatibility path / reports failure |
| Canvas WebP encoding | Animated WebP frame encoding | Animated WebP export is unavailable |
| `matchMedia` | reduced-motion support | Editor still works without preference detection |
| Blob / Object URLs | downloads and local resources | Export/download workflow unavailable |

Open the published site with:

```text
?selftest=1
```

The diagnostics dialog opens automatically and can export a JSON report.

## Smoke-suite coverage

The browser tests currently cover:

- editor boot without page errors;
- real PNG import;
- Auto Slice;
- Object Slice;
- source-cell include/exclude;
- Trim / Before-After comparison;
- multi-frame onion skin;
- playback;
- GIF export;
- APNG export;
- capability-aware Animated WebP export;
- full `.sss` persistence;
- custom anchors;
- skeletal cubic-bezier persistence;
- rigging / IK controls;
- accessibility runtime;
- built-in Diagnostics.

## Release compatibility rule

Before a stable release:

1. run `npm run check`;
2. run `npm run test:smoke` on all three Playwright projects;
3. run the deployed Pages URL with `?selftest=1`;
4. record any browser-specific exceptions in this file;
5. do not describe a browser family as supported if a core workflow fails there.
