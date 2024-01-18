import fs from 'fs';
import { promisify } from 'util';
import * as github from '@actions/github';
import * as core from '@actions/core';
import path from 'path';

const readFileAsync = promisify(fs.readFile);

function getParserVersion(dockerfileStr: string): string {
  // Searches for the SNOOTY_PARSER_VERSION in Dockerfile.enhanced.
  // This should return an array with a single element e.g. [ 'SNOOTY_PARSER_VERSION=0.15.2' ]
  const matchResult = dockerfileStr.match(/SNOOTY_PARSER_VERSION=\d+.\d+.\d?/g);

  if (!matchResult)
    throw new Error(
      'ERROR! Could not find SNOOTY_PARSER_VERSION in Dockerfile.enhanced',
    );

  // Grabbing the string 'SNOOTY_PARSER_VERSION=0.15.2', splitting using the '=' as the
  // delimiter, and then grabbing the second value which should be the parser version.
  const currentVersion = matchResult[0].split('=')[1];

  // Trimming just in case any extra whitespace finds its way into the result
  return currentVersion.trim();
}

interface GetReleaseQueryResponse {
  data: {
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
  };
}

interface GetDockerfileQueryResponse {
  data: {
    repository: {
      dockerfile: {
        text: string;
      };
    };
  };
}

async function getLastReleaseDockerfile(): Promise<string> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    core.error('ERROR! GITHUB_TOKEN is not set as an environment variable.');

    throw new Error('Failed. GITHUB_TOKEN is not set.');
  }

  const GQL_DIR = path.join(__dirname, 'gql');
  const [prevReleaseQuery, getDockerfileQuery] = await Promise.all([
    readFileAsync(`${GQL_DIR}/prev-release-query.gql`).then(result =>
      result.toString(),
    ),
    readFileAsync(`${GQL_DIR}/get-dockerfile-by-commit-hash.gql`).then(result =>
      result.toString(),
    ),
  ]);

  const { graphql } = github.getOctokit(githubToken);

  const gqlResponse = await graphql<GetReleaseQueryResponse>(prevReleaseQuery);
  console.log(gqlResponse);
  // flattening it to make it more readable
  const releases = gqlResponse.data.repository.releases.nodes.map(
    node => node.tag.target.oid,
  );

  const previousReleaseHash = releases.filter(
    commitHash => commitHash !== github.context.sha,
  )[0];

  const getDockerfileResponse = await graphql<GetDockerfileQueryResponse>(
    getDockerfileQuery,
    {
      hashWithFilename: `${previousReleaseHash}:Dockerfile.enhanced`,
    },
  );

  return getDockerfileResponse.data.repository.dockerfile.text;
}

async function main(): Promise<void> {
  const [dockerfileEnhanced, previousDockerfileEnhanced] = await Promise.all([
    readFileAsync('Dockerfile.enhanced').then(result => result.toString()),
    getLastReleaseDockerfile(),
  ]);

  const currentParserVersion = getParserVersion(dockerfileEnhanced);
  const previousParserVersion = getParserVersion(previousDockerfileEnhanced);

  core.setOutput(
    'shouldRebuildCaches',
    `${currentParserVersion !== previousParserVersion}`,
  );
}

main();
