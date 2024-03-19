import 'dotenv/config';
import fs from 'fs';
import { LHServer } from './lh-server.js';
import {
  getCurrentHash,
  getCommitTime,
  getCurrentBranch,
  getExternalBuildUrl,
  getCommitMessage,
  getAuthor,
  getAvatarUrl,
  getAncestorHashForBase,
  getAncestorHashForBranch,
} from '@lhci/utils/src/build-context.js';
import * as chromeLauncher from 'chrome-launcher';
import { Build } from '@lhci/types/server.d.ts';
import lighthouse from 'lighthouse/core/index.cjs';
import { Flags, Result } from 'lighthouse';

interface LHRdata {
  url: string;
  lhr: Result;
}

const lhrs: LHRdata[] = [];

async function main(): Promise<void> {
  const url = process.env.STAGING_URL;
  if (!url) {
    console.error('no url');
    return;
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options: Flags = {
    logLevel: 'info',
    output: 'html',
    port: chrome.port,
  };

  // Run Lighthouse on each url
  const runnerResult = await lighthouse(url, options);
  if (!runnerResult) {
    console.error('Lighthouse run undefined');
    return;
  }
  const { lhr } = runnerResult;
  let report: string;
  if (Array.isArray(runnerResult.report)) {
    report = runnerResult.report[0];
  } else {
    report = runnerResult.report;
  }

  if (lhr.runtimeError)
    throw new Error(
      `Lighthouse had a runtime error: ${lhr.runtimeError.message}`,
    );

  // Write html report
  const reportName = `lh-report.html`;
  console.log(`Writing report: ${reportName}`);
  fs.writeFileSync(reportName, report);

  // Store lhr for lighthouse upload
  lhrs.push({
    lhr,
    url,
  });

  const server = new LHServer();
  await server.setProject();
  process.chdir('/Users/matt.meigs/Desktop/docs-platform/snooty');

  // Get build context
  const baseBranch = server.project.baseBranch || 'master';
  const hash = getCurrentHash();
  const branch = getCurrentBranch();
  const ancestorHash =
    branch === baseBranch
      ? getAncestorHashForBase()
      : getAncestorHashForBranch('HEAD', baseBranch);

  const buildInfo: Build = {
    lifecycle: 'unsealed',
    hash: hash + Date.now(),
    branch,
    ancestorHash,
    commitMessage: getCommitMessage(hash),
    author: getAuthor(hash),
    avatarUrl: getAvatarUrl(hash),
    externalBuildUrl: getExternalBuildUrl(),
    runAt: new Date().toISOString(),
    committedAt: getCommitTime(hash),
    ancestorCommittedAt: ancestorHash ? getCommitTime(ancestorHash) : undefined,
  };

  const build = await server.createBuild(buildInfo);
  // Upload run to build
  await server.createRun(build, lhr);
  await server.sealBuild(build);
  await server.api.close();
}

main();
