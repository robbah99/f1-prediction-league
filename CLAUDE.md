# CLAUDE.md

## Project overview
F1 Prediction League — a single-page React app where 4 friends predict F1 race podiums and compete for points across the 2026 season.

## Tech stack
- **React 18** single-file app (`src/App.jsx`) — all components live in one file
- **Vite** for dev server and builds
- **Tailwind CSS** loaded via CDN (`<script src="https://cdn.tailwindcss.com">`) with custom config in `index.html`
- **Firebase Firestore** for real-time data (predictions + results stored in `f1data` collection)
- **OpenF1 API** (`https://api.openf1.org/v1`) for race calendar, sessions, and driver data
- **Recharts** for the points progression chart
- **Lucide React** for icons
- **Vercel** for hosting

## File structure
```
index.html          — entry point, Tailwind config, custom CSS (animations, patterns)
src/App.jsx         — entire app: components, state, Firebase logic, API calls
src/main.jsx        — React root render
vite.config.json    — Vite config
package.json        — dependencies
```

## Key commands
- `npm run dev` — start dev server (localhost:5173)
- `npm run build` — production build to `dist/`
- `vercel --prod` — deploy to production

## Architecture notes
- **No router** — tabs are managed via `activeTab` state, not URL routes
- **No separate API layer** — Firebase and OpenF1 calls are inline in `App.jsx`
- **No auth library** — hardcoded users array with simple password check, session stored in localStorage/sessionStorage
- **All styling is Tailwind utility classes** — custom CSS in `index.html` is only for animations and patterns that Tailwind can't handle (checkered bg, starting lights, speed stripes)
- **All graphics are pure CSS/SVG** — no external image files, no copyrighted logos

## Design system
- **Font**: Titillium Web (Google Fonts)
- **Colors** defined in Tailwind config as `f1-*`:
  - `f1-red`: #E10600 (primary accent)
  - `f1-dark`: #15151E (page background)
  - `f1-card`: #1F1F27 (card background)
  - `f1-surface`: #2D2D3A (elevated surface)
  - `f1-muted`: #38384A (borders, disabled)
- **Typography**: uppercase + tracking-wider + font-f1 for headings/labels
- **Monospace numbers**: `f1-mono` class for tabular-nums

## Data model
- **Firebase `f1data/predictions`**: `{ [round]: { [username]: { first, second, third, timestamp } } }`
- **Firebase `f1data/results`**: `{ [round]: { podium: [driverId, driverId, driverId] } }`
- **Driver IDs**: lowercase last name (e.g., `verstappen`), with `-{number}` suffix if duplicates
- **Scoring**: 10 pts exact position, 5 pts off-by-one, 2 pts off-by-two

## Important constants
- `USERS` — hardcoded user list (Robert, Johan, Fredrik, Klas)
- `TEAM_COLORS` — maps team names to hex colors for all 10 F1 teams
- `TEAM_ORDER` — display order for teams tab (approximate constructor standings)
- `TeamEmblem` — inline SVG icons for each team (abstract/geometric, not real logos)

## Deployment
- Vercel project: `f1-prediction-league`
- Production URL: https://f1-prediction-league.vercel.app
- Deploy with: `vercel --prod`
- No CI/CD — manual deploys only
