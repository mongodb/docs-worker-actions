import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { MongoClient } from 'mongodb';
import * as core from '@actions/core';
import * as github from '@actions/github';

async function getParameters(env: string): Promise<unknown> {
  const parameters = [''];
  const ssmPrefix = `/env/${env}/docs/worker_pool`;
  const ssmClient = new SSMClient({ region: process.env.CDK_DEFAULT_REGION });

  const pathToEnvMap: Map<string, string> = new Map();

  pathToEnvMap.set(`${ssmPrefix}/atlas/password`, 'MONGO_ATLAS_PASSWORD');
  pathToEnvMap.set(`${ssmPrefix}/atlas/username`, 'MONGO_ATLAS_USERNAME');
  pathToEnvMap.set(`${ssmPrefix}/atlas/host`, 'MONGO_ATLAS_HOST');

  const parametersMap: Record<string, string> = {};

  await Promise.all(
    parameters.map(async paramName => {
      const fullParamPath = `${ssmPrefix}${paramName}`;
      const getParamCommand = new GetParameterCommand({
        Name: fullParamPath,
        WithDecryption: true,
      });

      const ssmResponse = await ssmClient.send(getParamCommand);
      const paramString = ssmResponse.Parameter?.Value;

      const envName = pathToEnvMap.get(fullParamPath);

      if (!envName || !paramString) {
        console.error(
          `ERROR! Could not retrieve string for the following param: ${paramName}`,
        );
        return;
      }

      parametersMap[envName] = paramString;
    }),
  );
  return parametersMap;
}

async function getMongoClient(): Promise<void> {
  const client = new MongoClient('');
}

/**
 * Get repos branches entries from atlas and verify owner by
 * using the GitHub API to search for the repo URL.
 */
export async function getRepos(): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    core.error('ERROR! GITHUB_TOKEN is not set as an environment variable.');

    throw new Error('Failed. GITHUB_TOKEN is not set.');
  }

  const { graphql } = github.getOctokit(githubToken);

  const parameters = await getParameters('dotcomstg');
  await getMongoClient(parameters);
  return;
}
