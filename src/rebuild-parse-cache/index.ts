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
 * The value of the `SNOOTY_PARSER_VERSION` is compared between the two. The value in the Dockerfile is used.
 * The following steps take place during the action:
 *
 * 1. We check the Dockerfile's value for the SNOOTY_PARSER_VERSION build argument from the Dockerfile associated with the given build.
 * It is assumed that the given build is a part of a release.
 *
 * 2. We also load the last release's Dockerfile, and retrieve the SNOOTY_PARSER_VERSION value from there as well. We then compare the two values.
 * If the two values differ, we continue with the process.
 *
 * 3. If they differ, we then deploy an updated version of the cache updater stack to use the latest version of the Snooty Parser that the Autobuilder is using in the release.
 *
 * 4. After the cache updater stack has been deployed with the latest changes, we find all of the doc sites, and then send a post request to the cache updater stack endpoint
 * with an array of the doc sites.
 */
async function main(): Promise<void> {
  const WORKSPACE = process.env.WORKSPACE;

  const [dockerfile, previousDockerfile] = await Promise.all([
    readFileAsync(`${WORKSPACE}/Dockerfile`).then(result => result.toString()),
    getLastReleaseDockerfile(),
  ]);

  const currentParserVersion = getParserVersion(dockerfile);
  const previousParserVersion = getParserVersion(previousDockerfile);

  // keeping this logging here to verify we are parsing the correct versions.
  console.log(`CURRENT RELEASE PARSER VERSION: ${currentParserVersion}`);
  console.log(`PREVIOUS RELEASE PARSER VERSION: ${previousParserVersion}`);
  const shouldForceRun = process.env.FORCE_RUN === 'true';
  if (currentParserVersion === previousParserVersion && !shouldForceRun) return;

  console.log(
    `Updating cache ${shouldForceRun ? 'via force run' : 'via version update'}`,
  );

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
    ],
    { cwd: `${WORKSPACE}/cdk-infra` },
  );

  const repos = await getRepos();
  const apiKey = await getApiKey();

  const CACHE_UPDATE_URL =
    'https://aawdhgnscj.execute-api.us-east-2.amazonaws.com/prod/webhook';
  try {
    await axios.post(CACHE_UPDATE_URL, repos, {
      headers: {
        'x-api-key': apiKey,
      },
    });
  } catch (e) {
    if (e instanceof AxiosError) {
      console.error(`Could not send request. Response code: ${e.code}`);
      throw e;
    }
    console.error('could not send request');
    throw e;
  } finally {
    process.exit(0);
  }
}

main();
