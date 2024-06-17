/**
 * This action will need to be run after using a lhci command in a Github workflow.
 * That command write files to the specified file directory.
 * The structure and documentation of the outputted files can be found here: 
 * https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#outputdir
 
 * This action will read the manifest.json file, use this to sort the multiple Lighthouse runs of the same url/environment,
 * average the summaries together, read the html and json files of each, combine all of this into one document,
 * and finally upload this metadata on each macro-run to the appropriate Atlas collection.
 */
import fs from 'fs';
import * as github from '@actions/github';
import { promisify } from 'util';
import { MongoClient } from 'mongodb';

const readFileAsync = promisify(fs.readFile);

/* Summary of important Lighthouse scores of a run already "summarized" by lighthouse library */
interface Summary {
  seo: number;
  performance: number;
  'best-practices': number;
  pwa: number;
  accessibility: number;
}
const summaryProperties: (keyof Summary)[] = [
  'seo',
  'performance',
  'best-practices',
  'pwa',
  'accessibility',
];

/* Additional scores to average for DOP purposes */
interface ExtendedSummary extends Summary {
  'largest-contentful-paint': number;
  'first-contentful-paint': number;
  'total-blocking-time': number;
  'speed-index': number;
  'cumulative-layout-shift': number;
  interactive: number;
}
const extendedSummaryProperties: (keyof ExtendedSummary)[] = [
  'largest-contentful-paint',
  'first-contentful-paint',
  'total-blocking-time',
  'speed-index',
  'cumulative-layout-shift',
  'interactive',
];

/* Manifest structure outputted for each Lighthouse run */
interface Manifest {
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
interface JsonRun {
  [k: string]: unknown;
  audits: {
    [k in keyof ExtendedSummary]: {
      [k: string]: unknown;
      score: number;
    };
  };
}

interface RunDocument {
  jsonRuns: JsonRun[];
  htmlRuns: string[];
  summary: ExtendedSummary;
  url: string;
  type: 'desktop' | 'mobile';
  commitHash: string;
  commitMessage: string;
  commitTimestamp: string;
  author: string;
  project: string;
  branch: string;
}

const DB_NAME = `lighthouse`;
/* Used on PR creation and update (synchronize) */
const PR_COLL_NAME = `pr_reports`;
/* Used on merge to main in Snooty to keep running scores of production */
const MAIN_COLL_NAME = `main_reports`;

/* Helpers */
const getEmptySummary = (): ExtendedSummary => ({
  seo: 0,
  performance: 0,
  'best-practices': 0,
  pwa: 0,
  accessibility: 0,
  'largest-contentful-paint': 0,
  'first-contentful-paint': 0,
  'speed-index': 0,
  interactive: 0,
  'total-blocking-time': 0,
  'cumulative-layout-shift': 0,
});

const getAverageSummary = (
  manifests: Manifest[],
  jsonRuns: JsonRun[],
): ExtendedSummary => {
  const summary = getEmptySummary();
  for (const property of summaryProperties) {
    summary[property] =
      manifests.reduce((acc, cur) => acc + cur.summary[property], 0) /
      manifests.length;
  }
  for (const property of extendedSummaryProperties) {
    summary[property] =
      jsonRuns.reduce((acc, cur) => acc + cur.audits[property].score, 0) /
      jsonRuns.length;
  }
  return summary;
};

/* Reads and returns files of runs in arrays */
const getRuns = async (
  manifests: Manifest[],
): Promise<{ jsonRuns: JsonRun[]; htmlRuns: string[] }> => {
  const jsonRuns = [];
  const htmlRuns = [];

  for (const manifest of manifests) {
    jsonRuns.push(
      JSON.parse((await readFileAsync(manifest.jsonPath)).toString()),
    );

    htmlRuns.push((await readFileAsync(manifest.htmlPath)).toString());
  }

  await Promise.all(jsonRuns);
  await Promise.all(htmlRuns);
  return { jsonRuns, htmlRuns };
};

interface SortedRuns {
  jsonRuns: JsonRun[];
  htmlRuns: string[];
  summary: ExtendedSummary;
  url: string;
}

const sortAndAverageRuns = async (
  manifests: Manifest[],
): Promise<SortedRuns[]> => {
  const runs: {
    jsonRuns: JsonRun[];
    htmlRuns: string[];
    summary: ExtendedSummary;
    url: string;
  }[] = [];
  const uniqueUrls = new Set(manifests.map(manifest => manifest.url));

  for (const url of uniqueUrls) {
    const manifestsForUrl = manifests.filter(manifest => manifest.url === url);
    const { jsonRuns, htmlRuns } = await getRuns(manifestsForUrl);
    const summary = getAverageSummary(manifestsForUrl, jsonRuns);
    runs.push({ jsonRuns, htmlRuns, summary, url });
  }

  return runs;
};

const createRunDocument = (
  { url, summary, htmlRuns, jsonRuns }: SortedRuns,
  type: 'mobile' | 'desktop',
): RunDocument => {
  const commitHash = github.context.sha;
  const author = github.context.actor;
  const commitMessage = process.env.COMMIT_MESSAGE || '';
  const commitTimestamp =
    process.env.COMMIT_TIMESTAMP || new Date().toISOString();
  const project = process.env.PROJECT_TO_BUILD || '';
  const branch = process.env.BRANCH_NAME || '';

  console.log('commit message ', process.env.COMMIT_MESSAGE);
  console.log('what is context ', github.context);

  return {
    commitHash,
    commitMessage,
    commitTimestamp,
    author,
    project,
    branch,
    url,
    summary,
    htmlRuns,
    jsonRuns,
    type,
  };
};

async function main(): Promise<void> {
  const branch = process.env.BRANCH_NAME || '';

  try {
    const outputsFile = (
      await readFileAsync('./lhci/manifest.json')
    ).toString();

    const manifestsOfLighthouseRuns: Manifest[] = JSON.parse(outputsFile);

    /* Separate desktop from mobile manifests */
    const [desktopRunManifests, mobileRunManifests] =
      manifestsOfLighthouseRuns.reduce(
        (acc, cur) => {
          if (cur.url.includes('?desktop')) acc[0].push(cur);
          else acc[1].push(cur);
          return acc;
        },
        [[], []] as Manifest[][],
      );

    /* Average and summarize desktop runs */
    const desktopRuns = await sortAndAverageRuns(desktopRunManifests);
    const desktopRunDocuments = [];

    /* Construct full document for desktop runs */
    for (const desktopRun of desktopRuns) {
      desktopRunDocuments.push(createRunDocument(desktopRun, 'desktop'));
    }

    /* Average and summarize mobile runs */
    const mobileRuns = await sortAndAverageRuns(mobileRunManifests);
    const mobileRunDocuments = [];

    /* Construct full document for mobile runs */
    for (const mobileRun of mobileRuns) {
      mobileRunDocuments.push(createRunDocument(mobileRun, 'mobile'));
    }

    /* Merges to main branch are saved to a different collection than PR commits */
    const collectionName = branch === 'main' ? MAIN_COLL_NAME : PR_COLL_NAME;
    const client = new MongoClient(process.env.ATLAS_URI || '');
    const db = client.db(DB_NAME);

    console.log(
      `Uploading to Atlas DB ${DB_NAME} and Collection ${collectionName}...`,
    );
    const collection = db.collection(collectionName);
    await collection.insertMany([
      ...desktopRunDocuments,
      ...mobileRunDocuments,
    ]);

    console.log('Closing database connection');
    await client.close();
    return;
  } catch (error) {
    console.log('Error occurred when reading file', error);
    throw error;
  }
}

main();
