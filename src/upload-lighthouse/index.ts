import * as chromeLauncher from 'chrome-launcher';
// import { MongoClient } from "mongodb";
import lighthouse from 'lighthouse/core/index.cjs';
import { computeMedianRun } from 'lighthouse/core/lib/median-run';
import type { Flags } from 'lighthouse';
import {
  getCurrentHash,
  // getCommitTime,
  getCurrentBranch,
  // getExternalBuildUrl,
  // getCommitMessage,
  // getAuthor,
  // getAvatarUrl,
  // getAncestorHashForBase,
  // getAncestorHashForBranch,
} from '@lhci/utils/src/build-context';
// import { LHServer } from './lh-server';
// import { LHBuild } from './types/types';

// const DB_NAME = `lighthouse`;
// const REPOS_COLL_NAME = `reports`;

async function main(): Promise<void> {
  console.log('start');
  const url = process.env.STAGING_URL;
  console.log('url ', url);
  if (!url) {
    console.error('No URL for lighthouse specified.');
    return;
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options: Flags = {
    logLevel: 'info',
    output: 'json',
    port: chrome.port,
  };

  // Run Lighthouse on url
  const runs = new Array(3).fill(lighthouse(url, options));
  await Promise.all(runs);

  console.log('run before compute median')
  const medianLHR = computeMedianRun(runs);

  // const server = new LHServer();
  // await server.setProject();

  // Get build context - Snooty branch and commit data
  // const baseBranch = server.project?.baseBranch || 'main';
  const hash = getCurrentHash();
  const branch = getCurrentBranch();

  console.log('hash => ', hash);
  console.log('branch => ', branch);
  console.log('medianLHR => ', medianLHR);

  // TODO: replace this secret in github as generalized connection string, not mine
  // const client = new MongoClient(
  //   process.env.LIGHTHOUSE_CONNECTION_STRING as string,
  // );
  // const db = client.db(DB_NAME);

  // const lhRun = {
  //   commitHash: hash,
  // }

  // const ancestorHash =
  //   branch === baseBranch
  //     ? getAncestorHashForBase()
  //     : getAncestorHashForBranch('HEAD', baseBranch);

  // const buildInfo: Omit<LHBuild, 'projectId' | 'id'> = {
  //   lifecycle: 'unsealed',
  //   hash: hash + Date.now(),
  //   branch,
  //   ancestorHash,
  //   commitMessage: getCommitMessage(hash),
  //   author: getAuthor(hash),
  //   avatarUrl: getAvatarUrl(hash),
  //   externalBuildUrl: getExternalBuildUrl(),
  //   runAt: new Date().toISOString(),
  //   committedAt: getCommitTime(hash),
  //   ancestorCommittedAt: ancestorHash ? getCommitTime(ancestorHash) : undefined,
  // };

  // const build = await server.createBuild(buildInfo);
  // Upload run to build
  // await server.createRun(build, medianLHR, url);
  // await server.sealBuild(build);
  // await server.api.close();
}

main();
