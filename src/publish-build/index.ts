import * as core from '@actions/core';
import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandOutput,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';

const REQUIRED_ENV_VARS = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_BUCKET',
  'PROJECT',
  'SOURCE_DIR',
  'DESTINATION_DIR',
  'COMMIT_HASH',
];

function validateEnvVars(): void {
  for (const requiredVar of REQUIRED_ENV_VARS) {
    if (!process.env[requiredVar]) {
      const errMsg = `Required env variable missing: ${requiredVar}`;
      core.error(errMsg);
      throw new Error(errMsg);
    }
  }
}

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map(async dirent => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    }),
  );
  return Array.prototype.concat(...files);
}

async function upload(
  directoryPath: string,
  files: string[],
): Promise<PutObjectCommandOutput[]> {
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID'] ?? '';
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'] ?? '';
  const project = process.env['PROJECT'] ?? '';
  const commitHash = process.env['COMMIT_HASH'] ?? '';
  const destinationDir = process.env['DESTINATION_DIR'] ?? '';
  const client = new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  const bucket = process.env['AWS_BUCKET'] ?? '';

  const uploads = files.map(async file => {
    const key = `${destinationDir}/${file.substring(
      directoryPath.length + 1,
    )}/${project}/${commitHash}`;
    core.info(`check key ${key}`);
    const input: PutObjectCommandInput = {
      Body: createReadStream(file),
      Key: key,
      Bucket: bucket,
    };
    const command = new PutObjectCommand(input);
    return client.send(command);
  });
  return Promise.all(uploads);
}

async function main(): Promise<void> {
  validateEnvVars();
  const directoryPath = process.env['SOURCE_DIR'] ?? '';
  const files = await getFiles(directoryPath);
  await upload(directoryPath, files);
}

main();
