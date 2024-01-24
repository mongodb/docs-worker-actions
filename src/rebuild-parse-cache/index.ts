import fs from 'fs';
import { promisify } from 'util';
import * as github from '@actions/github';

import { getLastReleaseDockerfile } from './src/get-last-dockerfile';
import { getParserVersion } from './src/get-parser-version';
import { getApiKey, getRepos } from './src/get-repos';
import axios from 'axios';

const readFileAsync = promisify(fs.readFile);

/**
 * This custom action determines whether or not to rebuild the Snooty parse cache files.
 * It's determined based on the current release and previous release of the docs-worker-pool.
 * The value of the `SNOOTY_PARSER_VERSION` is compared between the two. The value in the Dockerfile.enhanced is used.
 */
async function main(): Promise<void> {
  const WORKSPACE = process.env.WORKSPACE;

  const [dockerfileEnhanced, previousDockerfileEnhanced] = await Promise.all([
    readFileAsync(`${WORKSPACE}/Dockerfile.enhanced`).then(result =>
      result.toString(),
    ),
    getLastReleaseDockerfile(),
  ]);

  const currentParserVersion = getParserVersion(dockerfileEnhanced);
  const previousParserVersion = getParserVersion(previousDockerfileEnhanced);

  // keeping this logging here to verify we are parsing the correct versions.
  console.log(`CURRENT RELEASE PARSER VERSION: ${currentParserVersion}`);
  console.log(`PREVIOUS RELEASE PARSER VERSION: ${previousParserVersion}`);

  // TODO: Instead of setting an output, we will want to send a request to the API Gateway endpoint in the scenario that
  // we want to rebuild the caches.

  const repos = await getRepos();
  const apiKey = await getApiKey();
  const CACHE_UPDATE_URL =
    'https://aawdhgnscj.execute-api.us-east-2.amazonaws.com/prod/webhook';

  axios.post(CACHE_UPDATE_URL, repos, {
    headers: {
      'x-api-key': apiKey,
    },
  });
}

main();
