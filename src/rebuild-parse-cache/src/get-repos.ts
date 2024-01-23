import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { MongoClient } from 'mongodb';
import * as core from '@actions/core';
import * as github from '@actions/github';
import path from 'path';
import { promisify } from 'util';
import fs from 'fs';

const readFileAsync = promisify(fs.readFile);

async function getParameters(env: string): Promise<Record<string, string>> {
  const ssmPrefix = `/env/${env}/docs/worker_pool`;
  const ssmClient = new SSMClient({ region: process.env.CDK_DEFAULT_REGION });
  const parameters = [
    `${ssmPrefix}/atlas/password`,
    `${ssmPrefix}/atlas/username`,
    `${ssmPrefix}/atlas/host`,
    `${ssmPrefix}/atlas/dbname`,
  ];

  const pathToEnvMap: Map<string, string> = new Map();

  pathToEnvMap.set(`${ssmPrefix}/atlas/password`, 'MONGO_ATLAS_PASSWORD');
  pathToEnvMap.set(`${ssmPrefix}/atlas/username`, 'MONGO_ATLAS_USERNAME');
  pathToEnvMap.set(`${ssmPrefix}/atlas/host`, 'MONGO_ATLAS_HOST');
  pathToEnvMap.set(`${ssmPrefix}/atlas/dbname`, 'MONGO_ATLAS_DBNAME');

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

async function getMongoClient({
  MONGO_ATLAS_PASSWORD,
  MONGO_ATLAS_USERNAME,
  MONGO_ATLAS_HOST,
}: Record<string, string>): Promise<MongoClient> {
  const atlasUrl = `mongodb+srv://${MONGO_ATLAS_USERNAME}:${MONGO_ATLAS_PASSWORD}@${MONGO_ATLAS_HOST}/admin?retryWrites=true`;
  const client = new MongoClient(atlasUrl);

  return client.connect();
}

interface RepoBranchEntry {
  repoName: string;
}

interface FindRepoResponse {
  search: {
    repos: Array<{
      repo: { owner: { login: string } };
    }>;
  };
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
  const client = await getMongoClient(parameters);

  const db = client.db(parameters.MONGO_ATLAS_DBNAME);

  const reposBranchesCollection = db.collection('repos_branches');

  const cursor = reposBranchesCollection.find<RepoBranchEntry>({});

  const GQL_DIR = path.join(__dirname, 'gql');
  const findRepoQuery = (
    await readFileAsync(`${GQL_DIR}/find-repo.gql`)
  ).toString();
  cursor.map(async ({ repoName }) => {
    const searchString = `repo:mongodb/${repoName} repo:10gen/${repoName}`;

    await graphql<FindRepoResponse>(findRepoQuery, { searchString });
  });
}
