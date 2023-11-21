import fs from 'fs';
import core from '@actions/core';
import github from '@actions/github';

// https://docs.github.com/en/actions/security-guides/automatic-token-authentication#about-the-github_token-secret
export async function run() {
  const prNumber = github.context.payload.pull_request?.number;

  core.info(`PR number, I think? ${prNumber}`);
  const githubToken = process.env.GITHUB_SECRET;

  if (!githubToken) {
    core.error('ERROR! GITHUB_SECRET is not set as an environment variable.');

    return;
  }

  return;
  try {
    const outputsFile = fs.readFileSync('cdk-infra/outputs.json').toString();
    const outputs = JSON.parse(outputsFile);

    const webhook = Object.values(
      outputs[
        `auto-builder-stack-enhancedApp-stg-${process.env.GIT_BRANCH}-webhooks`
      ]
    )[0];
    return webhook;
  } catch (error) {
    console.log('Error occurred when retrieving Webhook URL', error);
    return '';
  }
}

run();
