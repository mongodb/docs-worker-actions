import fs from 'fs';
import * as core from '@actions/core';
import * as github from '@actions/github';

export async function run() {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    core.error('ERROR! GITHUB_TOKEN is not set as an environment variable.');

    throw new Error('Failed. GITHUB_TOKEN is not set.');
  }

  const octokit = github.getOctokit(githubToken);

  const prNumber = github.context.payload.pull_request?.number;

  if (!prNumber) {
    core.error('ERROR! PR number is undefined');
    throw new Error('Could not retrieve PR number');
  }
  try {
    const outputsFile = fs.readFileSync('cdk-infra/outputs.json').toString();
    const outputs = JSON.parse(outputsFile);

    const webhook = Object.values(
      outputs[
        `auto-builder-stack-enhancedApp-stg-${process.env.GITHUB_HEAD_REF}-webhooks`
      ]
    )[0];

    await octokit.rest.issues.createComment({
      issue_number: prNumber,
      body: `Your feature branch infrastructure has been deployed! \n your webhook URL is: ${webhook}webhook/githubEndpoint/trigger/build\n for more information on how to use this endpoint, follow these [instructions](https://wiki.corp.mongodb.com/x/7FzoDg).`,
      owner: github.context.repo.owner,
      repo: github.context.repo.repo
    });
  } catch (error) {
    console.log('Error occurred when retrieving Webhook URL', error);
    throw error;
  }
}

run();
