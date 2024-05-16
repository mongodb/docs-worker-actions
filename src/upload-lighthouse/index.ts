import 'dotenv/config';
import * as chromeLauncher from 'chrome-launcher';
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

async function main(): Promise<void> {
  const url = process.env.STAGING_URL;
  if (!url) {
    console.error('No URL for lighthouse specified.');
    return;
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options: Flags = {
    logLevel: 'info',
    output: 'html',
    port: chrome.port,
  };

  // Run Lighthouse on url
  const runs = new Array(3).fill(lighthouse(url, options));
  await Promise.all(runs);
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
