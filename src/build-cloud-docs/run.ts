import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import type * as streamWeb from 'node:stream/web';
import * as github from '@actions/github';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';


export async function run(): Promise<void> {
  try {
    const parameters = await getParameters('dotcomstg');

    await exec.exec('git', ['clone', 'https://github.com/10gen/cloud-docs.git']);
    await exec.exec('git', ['clone', 'https://github.com/mongodb/snooty-parser.git']);
    await exec.exec('git', ['cd', './snooty-parser']);
    await exec.exec('poetry', ['run', 'snooty', 'build', './cloud-docs', '--output', 'cloud-docs.zip']);


  } catch (error) {
    console.error('Error occurred when fetching and writing build data for cloud-docs', error);
    throw error;
  }
}

const REGION = 'us-east-2';

async function getParameters(env: string): Promise<Record<string, string>> {
  const ssmPrefix = `/env/${env}/docs/worker_pool`;
  const ssmClient = new SSMClient({ region: REGION });
  const parameters = [
    '/atlas/password',
    '/atlas/username',
    '/atlas/host',
    '/atlas/dbname',
    '/github/bot/password',
  ];

  const pathToEnvMap: Map<string, string> = new Map();

  pathToEnvMap.set(`${ssmPrefix}/atlas/password`, 'MONGO_ATLAS_PASSWORD');
  pathToEnvMap.set(`${ssmPrefix}/atlas/username`, 'MONGO_ATLAS_USERNAME');
  pathToEnvMap.set(`${ssmPrefix}/atlas/host`, 'MONGO_ATLAS_HOST');
  pathToEnvMap.set(`${ssmPrefix}/atlas/dbname`, 'MONGO_ATLAS_DBNAME');
  pathToEnvMap.set(`${ssmPrefix}/github/bot/password`, 'GITHUB_BOT_PASSWORD');

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
