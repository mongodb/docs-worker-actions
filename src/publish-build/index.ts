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
] as const;

type RequiredVar = (typeof REQUIRED_ENV_VARS)[number];

type EnvParams = Record<RequiredVar, string>;

function getEnvVars(): EnvParams {
  const res: Partial<EnvParams> = {};
  for (const requiredVar of REQUIRED_ENV_VARS) {
    const envVar = process.env[requiredVar];
    if (!envVar) {
      const errMsg = `Required env variable missing: ${requiredVar}`;
      core.error(errMsg);
      throw new Error(errMsg);
    }
    res[requiredVar] = envVar;
  }
  return res as EnvParams;
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
  }: EnvParams,
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
