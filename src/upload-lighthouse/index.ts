import fs from 'fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { promisify } from 'util';

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

async function main(): Promise<void> {
  const prNumber = github.context.payload.pull_request?.number;
  const commitHash = github.context.sha;
  const author = github.context.actor;
  console.log('COMMIT HASH from context... ', commitHash);
  console.log('author from context... ', author);
  console.log('pr number from context.. ', prNumber);
  console.log('COMMIT Projec to build from env ', process.env.PROJECT_TO_BUILD);
  // Need Commit Message... don't know how

  try {
    const outputsFile = (
      await readFileAsync('./lhci/manifest.json')
    ).toString();
    const outputs = JSON.parse(outputsFile);

    console.log('OUTPUT of manifest json ', outputs);
    console.log('length ', outputs?.length);

    let results: string[] = [];

    const getAllFilesFromFolder = (dir: string): string[] => {
      fs.readdirSync(dir).forEach(function(file) {
          file = dir+'/'+file;
          const stat = fs.statSync(file);
  
          if (stat && stat.isDirectory()) {
              results = results.concat(getAllFilesFromFolder(file))
          } else results.push(file);
      });

      return results;
    };

    getAllFilesFromFolder(__dirname);

    console.log('File System: ', results);
  } catch (error) {
    console.log('Error occurred when reading file', error);
    throw error;
  }

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
}

main();
