import * as github from '@actions/github';
import { ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SortedRuns } from "./types";

// Html reports will be uploaded to S3
export async function uploadHtmlToS3(
    { htmlRuns, url, }: SortedRuns,
    type: 'mobile' | 'desktop'
  ) {
    const AWS_BUCKET = 'docs-lighthouse';
    const commitHash = github.context.sha;
    const branch = process.env.BRANCH_NAME || '';
    const client = new S3Client();
  
    const reportType = branch === 'main' ? 'main_reports': 'pr_reports';
  
    let cleanedUrl = url.replace('http://localhost:9000/', '');
    if (cleanedUrl.endsWith('?desktop')) cleanedUrl = cleanedUrl.slice(0, -8);
    cleanedUrl = cleanedUrl.split(/\/\/|\//).join('-');
  
    const destinationDir = `${reportType}/${commitHash}/${cleanedUrl}/${type}`;
  
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
  };