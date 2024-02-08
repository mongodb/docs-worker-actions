import * as core from '@actions/core';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandOutput,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { promises as fs, createReadStream } from 'fs';
import mime from 'mime';
import * as path from 'path';

const REQUIRED_ENV_VARS = [
  'AWS_BUCKET',
  'PROJECT',
  'SOURCE_DIR',
  'DESTINATION_DIR',
  'COMMIT_HASH',
  'GITHUB_WORKSPACE',
];

interface envParams {
  AWS_BUCKET: string;
  PROJECT: string;
  SOURCE_DIR: string;
  DESTINATION_DIR: string;
  COMMIT_HASH: string;
  GITHUB_WORKSPACE: string;
}

function getEnvVars(): envParams {
  const res: { [key: string]: string } = {};
  for (const requiredVar of REQUIRED_ENV_VARS) {
    if (!process.env[requiredVar]) {
      const errMsg = `Required env variable missing: ${requiredVar}`;
      core.error(errMsg);
      throw new Error(errMsg);
    }
    res[requiredVar] = process.env[requiredVar] ?? '';
  }
  return res as unknown as envParams;
}

async function getFileNames(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map(async dirent => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFileNames(res) : res;
    }),
  );
  return Array.prototype.concat(...files);
}

async function upload(
  {
    AWS_BUCKET,
    PROJECT,
    SOURCE_DIR,
    DESTINATION_DIR,
    COMMIT_HASH,
    GITHUB_WORKSPACE,
  }: envParams,
  fileNames: string[],
): Promise<PutObjectCommandOutput[]> {
  const client = new S3Client();

  const uploads = fileNames.map(async fileName => {
    const key = path.normalize(
      `${DESTINATION_DIR}/${PROJECT}/${COMMIT_HASH}/${path.relative(
        path.normalize(`${GITHUB_WORKSPACE}/${SOURCE_DIR}`),
        fileName,
      )}`,
    );
    const input: PutObjectCommandInput = {
      Body: createReadStream(fileName),
      Key: key,
      Bucket: AWS_BUCKET,
      ContentType: mime.getType(path.extname(fileName)) ?? '',
      CacheControl: 'no-cache',
    };
    const command = new PutObjectCommand(input);
    return client.send(command);
  });
  return Promise.all(uploads);
}

async function main(): Promise<void> {
  const envVars = getEnvVars();
  const fileNames = await getFileNames(envVars['SOURCE_DIR']);
  try {
    await upload(envVars, fileNames);
  } catch (e) {
    core.error(`Error while uploading to S3: ${e}`);
  }
}

main();
