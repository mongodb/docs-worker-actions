import fs from 'fs';
import core from '@actions/core';
import github from '@actions/github';
// https://docs.github.com/en/actions/security-guides/automatic-token-authentication#about-the-github_token-secret
export async function run() {
  const githubToken = core.getInput('githubToken');
  const octokit = github.getOctokit(githubToken);

  const { runNumber } = github.context;

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
