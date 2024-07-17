/* Summary of important Lighthouse scores of a run already "summarized" by lighthouse library */
export interface Summary {
  seo: number;
  performance: number;
  'best-practices': number;
  pwa: number;
  accessibility: number;
}
/* Additional scores to average for DOP purposes */
export interface ExtendedSummary extends Summary {
  'largest-contentful-paint': number;
  'first-contentful-paint': number;
  'total-blocking-time': number;
  'speed-index': number;
  'cumulative-layout-shift': number;
  interactive: number;
}

/* Manifest structure outputted for each Lighthouse run */
export interface Manifest {
  url: string;
  isRepresentativeRun: boolean;
  htmlPath: string;
  jsonPath: string;
  summary: Summary;
}

/*
 * General type to help define a very large JSON output
 * Documentation of JSON output: https://github.com/GoogleChrome/lighthouse/blob/main/docs/understanding-results.md
 */
export interface JsonRun {
  [k: string]: unknown;
  audits: {
    [k in keyof ExtendedSummary]: {
      [k: string]: unknown;
      score: number;
    };
  };
}

export interface RunDocument {
  summary: ExtendedSummary;
  url: string;
  type: 'desktop' | 'mobile';
  commitHash: string;
  commitMessage: string;
  commitTimestamp: Date;
  author: string;
  project: string;
  branch: string;
}

export interface SortedRuns {
  htmlRuns: string[];
  summary: ExtendedSummary;
  url: string;
}
