import fs from 'fs';
import { promisify } from 'util';
import * as github from '@actions/github';
import * as core from '@actions/core';

const readFileAsync = promisify(fs.readFile);

function getParserVersion(dockerfileStr: string) {
  // Searches for the SNOOTY_PARSER_VERSION in Dockerfile.enhanced.
  // This should return an array with a single element e.g. [ 'SNOOTY_PARSER_VERSION=0.15.2' ]
  const matchResult = dockerfileStr.match(/SNOOTY_PARSER_VERSION=\d+.\d+.\d?/g);

  if (!matchResult)
    throw new Error(
      'ERROR! Could not find SNOOTY_PARSER_VERSION in Dockerfile.enhanced'
    );

  // Grabbing the string 'SNOOTY_PARSER_VERSION=0.15.2', splitting using the '=' as the
  // delimiter, and then grabbing the second value which should be the parser version.
  const currentVersion = matchResult[0].split('=')[1];

  // Trimming just in case any extra whitespace finds its way into the result
  return currentVersion.trim();
}

async function getLastReleaseDockerfile() {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    core.error('ERROR! GITHUB_TOKEN is not set as an environment variable.');

    throw new Error('Failed. GITHUB_TOKEN is not set.');
  }

  const gqlQuery = (await readFileAsync('prev-release-query.gql')).toString();

  const { graphql } = github.getOctokit(githubToken);

  graphql(gqlQuery, {
    // TODO: Add git hash of current release
  });
}

async function main() {
  const dockerfileEnhanced = (
    await readFileAsync('Dockerfile.enhanced')
  ).toString();

  const currentParserVersion = getParserVersion(dockerfileEnhanced);
}

main();
