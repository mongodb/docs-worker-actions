import fs from 'fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import readline from 'readline';
// const readline = require('readline');


export async function run(): Promise<void> {
  // const githubToken = process.env.GITHUB_TOKEN;

  // if (!githubToken) {
  //   core.error('ERROR! GITHUB_TOKEN is not set as an environment variable.');

  //   throw new Error('Failed. GITHUB_TOKEN is not set.');
  // }

  // const octokit = github.getOctokit(githubToken);



  try {
    const file = 'output.txt'
    await downloadFile("https://snooty-data-api.mongodb.com/projects/cloud-docs/master/documents", file);


    const documents: any[] = [];
    let metadata: any;

    await readline.createInterface({
        input: fs.createReadStream(file),
        terminal: false
    }).on('line', function(line: string) {
      const parsedLine = JSON.parse(line)
      if (parsedLine.type === 'page') {
        documents.push(parsedLine)
      } else if (parsedLine.type === 'metadata') {
        metadata = parsedLine;
      }
    }).on('close', function(){
      const writable = fs.createWriteStream('snooty-documents.js', {flags:'w'});
      writable.write(JSON.stringify(documents));
      const metadataWriter = fs.createWriteStream('snooty-metadata.js', {flags:'w'});
      metadataWriter.write(JSON.stringify(metadata));
    });

    

    // const outputsFile = fs.readFileSync('cdk-infra/outputs.json').toString();
    // const outputs = JSON.parse(outputsFile);

    // const webhook = Object.values(
    //   outputs[
    //     `auto-builder-stack-enhancedApp-stg-${process.env.GITHUB_HEAD_REF}-webhooks`
    //   ]
    // )[0];

    // await octokit.rest.issues.createComment({
    //   issue_number: prNumber,
    //   body: `Your feature branch infrastructure has been deployed! \n\n Your webhook URL is: ${webhook}webhook/githubEndpoint/trigger/build\n\n For more information on how to use this endpoint, follow these [instructions](https://wiki.corp.mongodb.com/x/7FzoDg).`,
    //   owner: github.context.repo.owner,
    //   repo: github.context.repo.repo
    // });
  } catch (error) {
    console.log('Error occurred when retrieving Webhook URL', error);
    throw error;
  }
}

const downloadFile = async (url: string, fileName: string) => {
  const res = await fetch(url);
  const destination = path.resolve("./", fileName);
  const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
};
