# Chronicle — Timetable Tracker

A minimal, local-first personal consistency tracker built with vanilla HTML, CSS, and JavaScript.

## Features

- Local authentication
- Date-based Daily Tasks, Varying Tasks, and Rites & Rules
- Point-based daily scoring
- Previous days become read-only after the day ends
- Historical score snapshots
- Growth analytics and score history
- Winter Arc calendar for October–December 2026
- Separate one-off To-Dos that never affect scores, streaks, graphs, or Winter Arc status
- Browser-local persistence with `localStorage`

## Run

Open `index.html` in a modern browser. No build step or backend is required.

## Project structure

- `index.html` — application markup
- `style.css` — UI and responsive styling
- `app.js` — application state, scoring, authentication, task management, analytics, locking, and calendar logic

## Live URL 

- https://chronicle-fawn.vercel.app/

## Data model

Chronicle stores user data in the browser using `localStorage`. The app does not require a backend.

Historical scores are stored as snapshots so later task-definition changes do not rewrite completed days.

## License

Personal project.
