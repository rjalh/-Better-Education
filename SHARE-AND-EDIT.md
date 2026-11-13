# Edit Better Education without ChatGPT Plus

You own these source files. Forward this ZIP to your friend through any file-sharing service. They do not need ChatGPT, Plus, a Sites plugin, or an API key to edit and preview it.

1. Install Node.js 24 LTS and a free editor such as VS Code.
2. Extract the ZIP and open the Better-Education folder.
3. Open a terminal in that folder and run `npm ci`.
4. Run `npm run dev`.
5. Open http://localhost:5173 in a browser.
6. Edit files, save, and refresh the browser. Stop the server with Ctrl+C.

## What to edit
- `src/App.jsx`: dashboard, navigation, mascot chat and application shell.
- `src/Pages.jsx`: quizzes, materials, games, progress and admin screens.
- `src/styles.css`: colors, spacing, typography and mobile layouts.
- `assets/beka.png`: replace the mascot with another PNG using the same filename.
- `server/data.js`: learning materials, quizzes and sample data.
- `server/api.js`: server rules, role checks and rewards.

The local server uses the demo profile, browser-local saved changes, and prepared tutor answers. All five roles can be previewed using the demo selector. It does not connect to your real students or production database. Use the browser's site-data controls to reset demo changes.

The existing Sign in link belongs to ChatGPT-hosted deployment and is unnecessary for local editing. Actual multi-user production deployment on another host requires its own trusted authentication middleware and database setup; the demo role selector is not production authentication. Optional real AI requires separately billed provider access, not ChatGPT Plus.

Run `npm test` for API checks and `npm run build` for a Worker bundle. The Cloudflare-compatible backend uses a D1 binding named DB and SQL migrations in drizzle/. Keep any provider secrets on the server. Do not trust client-supplied identity headers on a public server.
