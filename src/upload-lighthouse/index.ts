import fs from 'fs';
import * as github from '@actions/github';
import { promisify } from 'util';
import { MongoClient } from 'mongodb';

const readFileAsync = promisify(fs.readFile);

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

interface Manifest {
  url: string;
  isRepresentativeRun: boolean;
  htmlPath: string;
  jsonPath: string;
  summary: Summary;
}

interface JsonRun {
  /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
  [k: string]: any;
}

const DB_NAME = `lighthouse`;
const PR_COLL_NAME = `pr_reports`;
const MAIN_COLL_NAME = `main_reports`;

const getEmptySummary = (): Summary => ({
  seo: 0,
  performance: 0,
  'best-practices': 0,
  pwa: 0,
  accessibility: 0,
});

const getAverageSummary = (manifests: Manifest[]): Summary => {
  const summary = getEmptySummary();
  for (const property of summaryProperties) {
    summary[property] =
      manifests.reduce((acc, cur) => acc + cur.summary[property], 0) /
      manifests.length;
  }
  return summary;
};

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

const sortAndReadRuns = async (
  manifests: Manifest[],
): Promise<
  { jsonRuns: JsonRun[]; htmlRuns: string[]; summary: Summary; url: string }[]
> => {
  const runs: {
    jsonRuns: JsonRun[];
    htmlRuns: string[];
    summary: Summary;
    url: string;
  }[] = [];
  const uniqueUrls = new Set(manifests.map(manifest => manifest.url));

  for (const url of uniqueUrls) {
    const manifestsForUrl = manifests.filter(manifest => manifest.url === url);
    const summary = getAverageSummary(manifestsForUrl);
    const { jsonRuns, htmlRuns } = await getRuns(manifestsForUrl);
    runs.push({ jsonRuns, htmlRuns, summary, url });
  }

  return runs;
};

async function main(): Promise<void> {
  const commitHash = github.context.sha;
  const author = github.context.actor;
  const commitMessage = process.env.COMMIT_MESSAGE || '';
  const commitTimestamp = process.env.COMMIT_TIMESTAMP || '';
  const project = process.env.PROJECT_TO_BUILD || '';
  const branch = process.env.BRANCH_NAME || '';

  try {
    const outputsFile = (
      await readFileAsync('./lhci/manifest.json')
    ).toString();

    const manifestsOfLighthouseRuns: Manifest[] = JSON.parse(outputsFile);

    const [desktopRunManifests, mobileRunManifests] =
      manifestsOfLighthouseRuns.reduce(
        (acc, cur) => {
          if (cur.url.includes('?desktop')) acc[0].push(cur);
          else acc[1].push(cur);
          return acc;
        },
        [[], []] as Manifest[][],
      );

    const desktopRuns = await sortAndReadRuns(desktopRunManifests);
    const desktopRunDocuments = [];

    for (const desktopRun of desktopRuns) {
      const { htmlRuns, jsonRuns, summary, url } = desktopRun;
      desktopRunDocuments.push({
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
        type: 'desktop',
      });
    }

    const mobileRuns = await sortAndReadRuns(mobileRunManifests);
    const mobileRunDocuments = [];

    for (const mobileRun of mobileRuns) {
      const { htmlRuns, jsonRuns, summary, url } = mobileRun;
      mobileRunDocuments.push({
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
        type: 'mobile',
      });
    }

    console.log('Uploading to MongoDB...');
    const collectionName = branch === 'main' ? MAIN_COLL_NAME : PR_COLL_NAME;
    const client = new MongoClient(process.env.ATLAS_URI || '');
    const db = client.db(DB_NAME);

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
