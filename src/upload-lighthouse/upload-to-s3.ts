import * as github from '@actions/github';
import {
  ObjectCannedACL,
  PutObjectCommand,
  PutObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { SortedRuns } from './types';

// Html reports will be uploaded to S3
export async function uploadHtmlToS3(
  { htmlRuns, url }: SortedRuns,
  type: 'mobile' | 'desktop',
): Promise<PutObjectCommandOutput[]> {
  const AWS_BUCKET = 'docs-lighthouse';
  const client = new S3Client();

  const destinationDir = derivePathFromReport(url, type);

  const uploads = htmlRuns.map(async (htmlReport, i) => {
    const key = `${destinationDir}/${i + 1}.html`;
    console.log('Uploading to S3 at ', key);

    const input = {
      Body: Buffer.from(htmlReport),
      Key: key,
      Bucket: AWS_BUCKET,
      ContentType: 'text/html',
      CacheControl: 'no-cache',
      ACL: ObjectCannedACL.public_read,
    };
    const command = new PutObjectCommand(input);
    return client.send(command);
  });
  return Promise.all(uploads);
}

function derivePathFromReport(url: string, type: 'mobile' | 'desktop'): string {
  const commitHash = github.context.sha;
  const branch = process.env.BRANCH_NAME || '';

  const reportType = branch === 'main' ? 'main_reports' : 'pr_reports';

  let cleanedUrl = url.replace('http://localhost:9000/', '');
  cleanedUrl = cleanedUrl.replace('?desktop', '');
  if (cleanedUrl.endsWith('/')) cleanedUrl = cleanedUrl.slice(0, -1);

  return `${reportType}/${commitHash}/${cleanedUrl}/${type}`;
}
