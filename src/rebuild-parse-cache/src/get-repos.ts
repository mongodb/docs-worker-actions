import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { MongoClient } from 'mongodb';
import * as core from '@actions/core';
import * as github from '@actions/github';
import path from 'path';
import { promisify } from 'util';
import fs from 'fs';
import {
  APIGatewayClient,
  GetApiKeyCommand,
} from '@aws-sdk/client-api-gateway';

const readFileAsync = promisify(fs.readFile);

const REGION = 'us-east-2';

async function getParameters(env: string): Promise<Record<string, string>> {
  const ssmPrefix = `/env/${env}/docs/worker_pool`;
  const ssmClient = new SSMClient({ region: REGION });
  const parameters = [
    '/atlas/password',
    '/atlas/username',
    '/atlas/host',
    '/atlas/dbname',
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

      const envName = pathToEnvMap.get(fullParamPath);

      try {
        const ssmResponse = await ssmClient.send(getParamCommand);
        const paramString = ssmResponse.Parameter?.Value;

        if (!envName || !paramString) {
          console.error(
            `ERROR! Could not retrieve string for the following param: ${paramName}`,
          );
          return;
        }

        core.setSecret(paramString);
        parametersMap[envName] = paramString;
      } catch (e) {
        console.error(`Could not retrieve ${envName}`);
      }
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
  core.setSecret(atlasUrl);
  const client = new MongoClient(atlasUrl);
  try {
    const connectedClient = await client.connect();

    process.on('SIGTERM', async () => {
      await connectedClient.close();
    });

    return connectedClient;
  } catch (e) {
    throw new Error('Failed to connect to DB');
  }
}

export async function getApiKey(): Promise<string> {
  const API_KEY_NAME = 'zxccutwa64';

  const client = new APIGatewayClient({ region: REGION });
  const command = new GetApiKeyCommand({
    apiKey: API_KEY_NAME,
    includeValue: true,
  });

  const { value } = await client.send(command);
  if (!value) throw new Error('No value found for API key');

  core.setSecret(value);
  return value;
}

export interface RepoInfo {
  repoOwner: string;
  repoName: string;
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
export async function getRepos(): Promise<RepoInfo[]> {
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

  const repos: RepoInfo[] = [];
  const findRepoQuery = (
    await readFileAsync(`${GQL_DIR}/find-repo.gql`)
  ).toString();

  const repoNames = await cursor.map(({ repoName }) => repoName).toArray();
  try {
    await Promise.all(
      repoNames.map(async repoName => {
        const searchString = `repo:mongodb/${repoName} repo:10gen/${repoName}`;

        const response = await graphql<FindRepoResponse>(findRepoQuery, {
          searchString,
        });

        // Some sites have an internal and external representation (e.g. docs-monorepo is a repository in both 10gen and mongodb)
        const repoOwners = response.search.repos.map(
          ({ repo }) =>
            ({
              repoOwner: repo.owner.login,
              repoName,
            }) as RepoInfo,
        );

        repos.push(...repoOwners);
      }),
    );
  } finally {
    await cursor.close();
  }

  return repos;
}
