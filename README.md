# F1 Prediction League 2026

A prediction league app for the 2026 F1 season. Predict the podium for each race, earn points, and compete against friends.

Built with React, Vite, Tailwind CSS, Firebase (Firestore), and the OpenF1 API.

## Getting started

```bash
git clone https://github.com/robbah99/f1-prediction-league.git
cd f1-prediction-league
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Deploying

The app is hosted on Vercel. To deploy from a new machine:

```bash
npm i -g vercel
vercel login
vercel link        # select the existing project
vercel --prod      # deploy to production
```

Production URL: https://f1-prediction-league.vercel.app

## Tech stack

- **React 18** with Vite
- **Tailwind CSS** (CDN)
- **Firebase Firestore** for predictions and results storage
- **OpenF1 API** for race calendar and driver data
- **Recharts** for the points progression chart
- **Lucide React** for icons
