# Isolated browser verification

Run `pnpm test:e2e` with Node 24 and dependencies installed. The suite uses a local Chrome/Edge installation when found, otherwise Playwright Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to choose an existing browser executable.

The harness starts MongoMemoryServer, API on `127.0.0.1:4100`, and Next on `127.0.0.1:3100`. Those two ports must be free. It creates a random owner, password, secret and synthetic projects exclusively inside the disposable database. It never reads `.env` or uses an inherited Mongo URI. Published test cases therefore cannot reach the normal local or production database.

Browser evidence, private ephemeral credentials and generated media live in an OS temporary `portfolio-e2e-*` directory. `PORTFOLIO_E2E_RUN_DIR` can select a child of the OS temporary directory. Next requires a cache within the workspace and locks by application directory; each run gets a generated `.cache/e2e-web-*` directory with a source snapshot and public/dependency junctions. A private local shutdown handshake removes this directory and stops MongoDB on normal teardown, including Windows. An interrupted process can leave the cache behind. No real owner credentials are required.

Coverage includes RU/EN server HTML and locale/case links; normal-motion stage navigation/history; reduced-motion native links and all readable stages at 320, 390, 768, 1024, 1440, 1586 and 1920 pixels; horizontal overflow; and the owner workflow from UI project creation and upload through bilingual case/stage editing, private preview, publication, published snapshot isolation, home selection and logout. Repetitive metadata is prepared through the authenticated API; upload, blocks and all three home stages are entered through the browser.

`clypse-fit.spec.ts` uploads a visibly synthetic 1600×1000 PNG, checks all three current stage captions and image annotations in pinned RU/EN scenes at 1586×992 and 1920×1080, and verifies native stage anchors after a resize rebuild with long captions in normal document flow. `motion-fidelity.spec.ts` compares settled normal/reduced footer geometry and checks that the experience curve finishes at the section top and reverses before entry. These fixtures stay inside the disposable database.

The Browser plugin was unavailable in the authoring session, so the explicitly requested Playwright test suite supplied browser validation. Screenshots are evidence of selected routes and sizes, not a claim of exhaustive visual approval.
