import * as github from '@actions/github';
import { readFileAsync } from '.';
import { extendedSummaryProperties, summaryProperties } from './constants';
import {
  ExtendedSummary,
  JsonRun,
  Manifest,
  RunDocument,
  SortedRuns,
} from './types';

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
  const jsonRuns = await Promise.all(
    manifests.map(async manifest =>
      JSON.parse((await readFileAsync(manifest.jsonPath)).toString()),
    ),
  );

  const htmlRuns = await Promise.all(
    manifests.map(async manifest =>
      (await readFileAsync(manifest.htmlPath)).toString(),
    ),
  );

  return { jsonRuns, htmlRuns };
};

export const sortAndAverageRuns = async (
  manifests: Manifest[],
): Promise<SortedRuns[]> => {
  const uniqueUrls = Array.from(
    new Set(manifests.map(manifest => manifest.url)),
  );

  const runs: {
    htmlRuns: string[];
    summary: ExtendedSummary;
    url: string;
  }[] = await Promise.all(
    uniqueUrls.map(async url => {
      const manifestsForUrl = manifests.filter(
        manifest => manifest.url === url,
      );
      const { jsonRuns, htmlRuns } = await getRuns(manifestsForUrl);
      const summary = getAverageSummary(manifestsForUrl, jsonRuns);
      return { htmlRuns, summary, url };
    }),
  );

  return runs;
};

export const createRunDocument = (
  { url, summary }: SortedRuns,
  type: 'mobile' | 'desktop',
): RunDocument => {
  const commitHash = github.context.sha;
  const author = github.context.actor;
  const commitMessage = process.env.COMMIT_MESSAGE || '';
  const commitTimestamp = process.env.COMMIT_TIMESTAMP
    ? new Date(process.env.COMMIT_TIMESTAMP)
    : new Date();
  const project = process.env.PROJECT_TO_BUILD || '';
  const branch = process.env.BRANCH_NAME || '';

  return {
    commitHash,
    commitMessage,
    commitTimestamp,
    author,
    project,
    branch,
    url,
    summary,
    type,
  };
};
