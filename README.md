# Lead Management Frontend (Vercel-ready)

React (Create React App) frontend for the Lead Management System. Connects to the backend API and supports auth, lead CRUD, server-side pagination and filtering, and an AG Grid table.

## Tech stack

- React 18 + React Router
- MUI (Material UI)
- AG Grid React
- Axios (with credentials/cookies)

## Directory overview

- `public/` — Static assets and HTML template.
- `src/`
  - `index.js` — App bootstrap.
  - `App.jsx` — Routes setup.
  - `components/` — Shared UI (e.g., `Layout`, `PrivateRoute`).
  - `context/` — `AuthContext.jsx` for auth state and actions.
  - `config/axios.js` — Axios instance reading `REACT_APP_API_BASE_URL` and using `withCredentials: true`.
  - `pages/` — `Login`, `Register`, `LeadsList`, `LeadForm` screens.

## Environment variables

Copy `.env.example` to `.env` and adjust values.

- `REACT_APP_API_BASE_URL` — Backend API base URL.
  - Example (Render): `https://lead-management-backend-u62v.onrender.com`

Note: CRA only exposes variables prefixed with `REACT_APP_`.

## Run locally

```bash
npm install
npm start
```
- App runs at http://localhost:3000
- Backend default (dev) is http://localhost:8080 unless you set `REACT_APP_API_BASE_URL`.

## Build

```bash
npm run build
```
- Outputs production build to `build/`.

## Deployment (Vercel)

- Framework Preset: Create React App (auto)
- Build Command: `npm run build`
- Output Directory: `build`
- Environment Variables:
  - `REACT_APP_API_BASE_URL=https://lead-management-backend-u62v.onrender.com`

After first deploy, add the Vercel site origin to the backend `CORS_ORIGIN` (comma-separated) in Render.

## Features

- Auth with JWT httpOnly cookies (login sets cookie, Axios sends it with `withCredentials`).
- Leads table with AG Grid: search, filters, pagination, actions (Edit/Delete).
- Create/Edit lead forms with MUI components and date pickers.

## Troubleshooting

- 401 after login: ensure the backend allows your frontend origin (`CORS_ORIGIN`) and that you use `withCredentials: true`.
- Cookies not set on HTTPS: backend must set `SameSite=None; Secure` in production (already handled when `NODE_ENV=production`).
- Base URL issues: confirm `REACT_APP_API_BASE_URL` is set on Vercel and the app was redeployed after changes.

## License

MIT
