import fs from 'fs';
import { promisify } from 'util';
import * as github from '@actions/github';
import * as core from '@actions/core';
import path from 'path';

const readFileAsync = promisify(fs.readFile);

interface GetReleaseQueryResponse {
  repository: {
    releases: {
      nodes: Array<{
        tag: {
          target: {
            oid: string;
          };
        };
      }>;
    };
  };
}

interface GetDockerfileQueryResponse {
  repository: {
    dockerfile: {
      text: string;
    };
  };
}

export async function getLastReleaseDockerfile(): Promise<string> {
  const githubToken = process.env.GITHUB_TOKEN;
  const tagSha = process.env.TEST_SHA ?? github.context.sha;

  if (!githubToken) {
    core.error('ERROR! GITHUB_TOKEN is not set as an environment variable.');

    throw new Error('Failed. GITHUB_TOKEN is not set.');
  }

  const { graphql } = github.getOctokit(githubToken);

  const GQL_DIR = path.join(__dirname, 'gql');
  const [prevTwoReleasesQuery, getDockerfileQuery] = await Promise.all([
    readFileAsync(`${GQL_DIR}/prev-release-query.gql`).then(result =>
      result.toString(),
    ),
    readFileAsync(`${GQL_DIR}/get-dockerfile-by-commit-hash.gql`).then(result =>
      result.toString(),
    ),
  ]);

  const prevTwoReleasesResponse =
    await graphql<GetReleaseQueryResponse>(prevTwoReleasesQuery);

  // flattening it to make it more readable
  const releaseGitHashes =
    prevTwoReleasesResponse.repository.releases.nodes.map(
      node => node.tag.target.oid,
    );

  // the GQL query returns the current and previous release. The `github.context.sha` contains
  // the current release's Git commit SHA, so we filter it out.
  const previousReleaseHash = releaseGitHashes.filter(
    commitHash => commitHash !== tagSha,
  )[0];

  const getDockerfileResponse = await graphql<GetDockerfileQueryResponse>(
    getDockerfileQuery,
    {
      hashWithFilename: `${previousReleaseHash}:Dockerfile.enhanced`,
    },
  );

  return getDockerfileResponse.repository.dockerfile.text;
}
