// Scaffold-owned glue file (STORY-105). Modules register at the markers below; do not edit the marked lines by hand.
// knm:imports
import { reportsRoute } from '../reports/reportsRoute'; // WI-007 (REQ-169)
import { freeQueriesRoute } from '../freeQueries/freeQueriesRoute'; // WI-015 (REQ-264)

export const routes = [
  // knm:entries
  reportsRoute, // WI-007 (REQ-169)
  freeQueriesRoute, // WI-015 (REQ-264)
  // knm:entries-end
];
