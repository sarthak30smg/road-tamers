ROAD TAMERS 1.9.3 — FIXED SHARED LEADERBOARD

This package keeps the game artwork/gameplay and adds real shared leaderboard endpoints:
  GET  /.netlify/functions/leaderboard
  POST /.netlify/functions/score
  GET  /.netlify/functions/suggestions
  POST /.netlify/functions/suggestions

The leaderboard no longer silently falls back to fake/demo players when the API is down.
Scores are stored per player in Netlify Blobs and sorted by server-calculated score.

IMPORTANT DEPLOY STEPS
1. Deploy this entire folder as a Netlify site (not just index.html). It must include netlify.toml, package.json, and netlify/functions/.
2. For a drag-and-drop upload, Netlify may not build/install function dependencies. Best method: upload this ZIP to a new GitHub repository and connect that repository to Netlify, or deploy with Netlify CLI so it can install @netlify/blobs and bundle the functions.
3. After deployment, open these URLs on your site:
   /.netlify/functions/leaderboard  (should return {"items":[]}, or actual records)
   /.netlify/functions/score only accepts POST.
4. Play the game, choose a racer name, and progress enough to have at least one car. The game submits score snapshots when it saves/progresses. Then open Leaderboard; another device/browser should see the same stored players after they submit scores.
5. In Netlify, open Site configuration > Environment variables and add RT_SUGGESTION_ADMIN_KEY with a long random secret (at least 32 random bytes). Set it for Functions and mark it as a secret if that option is available, then redeploy. Players can submit ideas privately. The Owner inbox in the game requires this key; the suggestions endpoint does not reveal submissions without it. The form needs Netlify Functions, so it cannot send from a local file preview or a static-only host such as GitHub Pages. Never put the key in index.html, config.js, or this repository.

Netlify Blobs is the persistent store. The function logs will show storage/setup errors rather than pretending the demo is a real leaderboard.
