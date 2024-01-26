import fs from 'fs';
import { promisify } from 'util';

import { getLastReleaseDockerfile } from './src/get-last-dockerfile';
import { getParserVersion } from './src/get-parser-version';
import { getApiKey, getRepos } from './src/get-repos';
import axios, { AxiosError } from 'axios';
import * as exec from '@actions/exec';
const readFileAsync = promisify(fs.readFile);

/**
 * This custom action determines whether or not to rebuild the Snooty parse cache files.
 * It's determined based on the current release and previous release of the docs-worker-pool.
 * The value of the `SNOOTY_PARSER_VERSION` is compared between the two. The value in the Dockerfile.enhanced is used.
 * The following steps take place during the action:
 *
 * 1. We check the Dockerfile.enhanced's value for the SNOOTY_PARSER_VERSION build argument from the Dockerfile.enhanced associated with the given build.
 * It is assumed that the given build is a part of a release.
 *
 * 2. We also load the last release's Dockerfile.enhanced, and retrieve the SNOOTY_PARSER_VERSION value from there as well. We then compare the two values.
 * If the two values differ, we continue with the process.
 *
 * 3. If they differ, we then deploy an updated version of the cache updater stack to use the latest version of the Snooty Parser that the Autobuilder is using in the release.
 *
 * 4. After the cache updater stack has been deployed with the latest changes, we find all of the doc sites, and then send a post request to the cache updater stack endpoint
 * with an array of the doc sites.
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

  if (currentParserVersion === previousParserVersion) return;

  await Promise.all([
    exec.exec('npm', ['ci'], { cwd: `${WORKSPACE}` }),
    exec.exec('npm', ['ci'], {
      cwd: `${WORKSPACE}/cdk-infra`,
    }),
  ]);

  await exec.exec(
    'npm',
    [
      'run',
      'deploy:feature:stack',
      '--',
      '-c',
      'customFeatureName=cacheUpdater',
      '-c',
      `snootyParserVersion=${currentParserVersion}`,
      'auto-builder-stack-cacheUpdater-cache',
      '--outputs-file',
      'outputs.json',
    ],
    { cwd: `${WORKSPACE}/cdk-infra` },
  );

  const outputsFile = (
    await readFileAsync('cdk-infra/outputs.json')
  ).toString();

  const outputs = JSON.parse(outputsFile);

  const webhookUrl = Object.values(
    outputs[
      `auto-builder-stack-enhancedApp-stg-${process.env.GITHUB_HEAD_REF}-webhooks`
    ],
  )[0];

  const repos = await getRepos();
  const apiKey = await getApiKey();

  const CACHE_UPDATE_URL = `${webhookUrl}webhook`;

  try {
    await axios.post(CACHE_UPDATE_URL, repos, {
      headers: {
        'x-api-key': apiKey,
      },
    });
  } catch (e) {
    if (e instanceof AxiosError) {
      throw new Error(`Could not send request. Response code: ${e.code}`);
    }
    throw new Error('could not send request');
  } finally {
    process.exit(0);
  }
}

main();
