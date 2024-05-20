import fs from 'fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { promisify } from 'util';
import { MongoClient } from 'mongodb';

const readFileAsync = promisify(fs.readFile);

// import * as chromeLauncher from 'chrome-launcher';
// import { MongoClient } from "mongodb";
// import lighthouse from 'lighthouse/core/index.cjs';
// import { computeMedianRun } from 'lighthouse/core/lib/median-run';
// import type { Flags } from 'lighthouse';
// import {
// getCurrentHash,
// getCommitTime,
// getCurrentBranch,
// getExternalBuildUrl,
// getCommitMessage,
// getAuthor,
// getAvatarUrl,
// getAncestorHashForBase,
// getAncestorHashForBranch,
// } from '@lhci/utils/src/build-context';
// import { LHServer } from './lh-server';
// import { LHBuild } from './types/types';

// const DB_NAME = `lighthouse`;
// const REPOS_COLL_NAME = `reports`;

interface Summary {
  seo: number;
  performance: number;
  'best-practices': number;
  pwa: number;
  accessibility: number;
}

const DB_NAME = `lighthouse`;
const REPOS_COLL_NAME = `reports`;

const getEmptySummary = (): Summary => ({
  seo: 0,
  performance: 0,
  'best-practices': 0,
  pwa: 0,
  accessibility: 0,
});

const getAverageSummary = (manifests: any[]): Summary => {
  const summary = getEmptySummary();
  for (const property of Object.keys(summary)) {
    console.log('summary prop ', property)
    console.log('value in reduce ', manifests.reduce((acc, cur) => acc[property] + cur[property], 0))
    // @ts-ignore
    summary[property] = (manifests.reduce((acc, cur) => acc[property] + cur[property], 0) / manifests.length)
  }
  return summary;
};

const getRuns = async (manifests: any[]): Promise<{ jsonRuns: any[], htmlRuns: string[] }> => {
  const jsonRuns = [];
  const htmlRuns = [];

  for (const manifest of manifests) {
    jsonRuns.push(JSON.parse((
      await readFileAsync(manifest.jsonPath)
    ).toString()));

    htmlRuns.push((
      await readFileAsync(manifest.htmlPath)
    ).toString());
  }

  await Promise.all(jsonRuns);
  await Promise.all(htmlRuns);
  return { jsonRuns, htmlRuns };
}

async function main(): Promise<void> {
  const commitHash = github.context.sha;
  const author = github.context.actor;
  console.log('COMMIT HASH from context... ', commitHash);
  console.log('author from context... ', author);
  console.log('COMMIT Projec to build from env ', process.env.PROJECT_TO_BUILD);
  // TODO: Need Commit Message...
  // Keep trying ${{ github.event.head_commit.message }}

  try {
    const outputsFile = (
      await readFileAsync('./lhci/manifest.json')
    ).toString();
    // @ts-ignore
    const manifestsOfLighthouseRuns: any[] = JSON.parse(outputsFile);

    console.log('OUTPUT of manifest json ', manifestsOfLighthouseRuns);
    
    // @ts-ignore
    const [desktopRunManifests, mobileRunManifests] = manifestsOfLighthouseRuns.reduce((acc, cur) => {
      if (cur.url.includes('?desktop')) acc[0].push(cur);
      else acc[1].push(cur);
      return acc;
    }, [[], []] as any[][]);
    
    const urlTested = mobileRunManifests[0].url;
    const desktopSummary = getAverageSummary(desktopRunManifests);
    const { htmlRuns: desktopHtmlRuns, jsonRuns: desktopJsonRuns } = await getRuns(desktopRunManifests);

    const desktopRunDocument = {
      commitHash,
      author,
      project: process.env.PROJECT_TO_BUILD,
      url: urlTested,
      summary: desktopSummary,
      htmlRuns: desktopHtmlRuns,
      jsonRuns: desktopJsonRuns,
      type: 'desktop',
    };

    const mobileSummary = getAverageSummary(mobileRunManifests);
    const { htmlRuns: mobileHtmlRuns, jsonRuns: mobileJsonRuns } = await getRuns(mobileRunManifests);

    const mobileRunDocument = {
      commitHash,
      author,
      project: process.env.PROJECT_TO_BUILD,
      url: urlTested,
      summary: mobileSummary,
      htmlRuns: mobileHtmlRuns,
      jsonRuns: mobileJsonRuns,
      type: 'mobile',
    };


    const client = new MongoClient(process.env.ATLAS_URI || '');
    const db = client.db(DB_NAME);

    const collection = db.collection(REPOS_COLL_NAME);
    const insertionMessage = await collection.insertMany([desktopRunDocument, mobileRunDocument]);
    console.log('insertion ', insertionMessage);

    console.log('Closing');
    await client.close();
    return;
  } catch (error) {
    console.log('Error occurred when reading file', error);
    throw error;
  }
}

main();
