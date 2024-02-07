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
  sourcePath: string,
  directoryPath: string,
  fileNames: string[],
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

  const uploads = fileNames.map(async fileName => {
    const key = path.normalize(
      `${destinationDir}/${project}/${commitHash}/${path.relative(
        path.normalize(`${sourcePath}/${directoryPath}`),
        fileName,
      )}`,
    );
    const input: PutObjectCommandInput = {
      Body: createReadStream(fileName),
      Key: key,
      Bucket: bucket,
      ContentType: mime.getType(path.extname(fileName)) ?? '',
      CacheControl: 'no-cache',
    };
    const command = new PutObjectCommand(input);
    return client.send(command);
  });
  return Promise.all(uploads);
}

async function main(): Promise<void> {
  validateEnvVars();
  const directoryPath = process.env['SOURCE_DIR'] ?? '';
  const ghWorkspace = process.env['GITHUB_WORKSPACE'] ?? '';
  const fileNames = await getFileNames(directoryPath);
  await upload(ghWorkspace, directoryPath, fileNames);
}

main();
