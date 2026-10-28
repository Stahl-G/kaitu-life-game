# Source and license provenance

## Kaitu game

- Source repository: https://github.com/Stahl-G/rensheng-kaitu
- Source directory: `prototypes/life-simulation`
- Fixed source commit: `fcc6bd89bb1e2f895ada70c323665ddfb8cfa52d`
- Original draft pull request (preserved): https://github.com/Stahl-G/rensheng-kaitu/pull/282
- Original project license: MIT, copyright (c) 2026 Guo Yihong. Full text is preserved in `LICENSE`.
- The initial independent repository copies the tracked game source, assets, tests and build scripts. Runtime modules and test files are unchanged. README paths, CI location and an optional loopback server `PORT` are adapted for standalone use.
- No main application, personal records, saves, credentials or acceptance screenshots are included. This repository is the source for subsequent game development; the original PR is a historical baseline.

## Remake

- Upstream: https://github.com/VickScarlet/remake
- Reviewed revision: `f04888e202e5dfca0df48c51b8a099dc03cf08b4`
- License: MIT, copyright (c) 2021–2026 神戸小鳥 and 神户小德.
- Reused modules: condition DSL and weighted random helpers in `src/vendor/remake/condition.ts` and `src/vendor/remake/random.ts`.
- Full upstream license is preserved in `src/vendor/remake/LICENSE` and copied to `dist/vendor/remake/LICENSE` by the build.
- Original upstream event text, spreadsheets and UI are not included. The game event pool and SVG scenes are original. No 1in8b code, images, event text or numeric parameters are copied.
