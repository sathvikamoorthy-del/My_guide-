# react-vite

Web framework module (STORY-053b). React 18 on Vite. `App` assembles the shell from the scaffold glue: `src/app/providers.tsx` entries wrap everything (first = outermost) and `src/app/router.tsx` entries become routes; unknown URLs show a not-found page and a crashing page shows a generic message (details only in the console). `main.tsx` mounts into `#root`. Run `npx vite` for development (`PORT`, default 5173) and `npx vite build` for production (dist/). Modules register routes as `{ id, ...route }` where `route = { path, element }`.
