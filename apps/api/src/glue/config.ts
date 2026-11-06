// Scaffold-owned glue file (STORY-105). Modules register at the markers below; do not edit the marked lines by hand.
// knm:imports

export const config = [
  // knm:entries
  { key: 'PORT', default: "3000" }, // knm:module express
  { key: 'DATABASE_URL', default: "file:./data/app.db" }, // knm:module sqlite-database
  { key: 'DATABASE_AUTH_TOKEN', default: "" }, // knm:module sqlite-database
  { key: 'JWT_SECRET', default: "" }, // knm:module jwt-auth
  { key: 'CACHE_TTL_SECONDS', default: "30" }, // knm:module memory-cache
  // knm:entries-end
];
