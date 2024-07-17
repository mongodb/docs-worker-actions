import { ExtendedSummary, Summary } from "./types";

export const DB_NAME = `lighthouse`;
/* Used on PR creation and update (synchronize) */
export const PR_COLL_NAME = `pr_reports`;
/* Used on merge to main in Snooty to keep running scores of production */
export const MAIN_COLL_NAME = `main_reports`;

export const summaryProperties: (keyof Summary)[] = [
  'seo',
  'performance',
  'best-practices',
  'pwa',
  'accessibility',
];
export const extendedSummaryProperties: (keyof ExtendedSummary)[] = [
  'largest-contentful-paint',
  'first-contentful-paint',
  'total-blocking-time',
  'speed-index',
  'cumulative-layout-shift',
  'interactive',
];