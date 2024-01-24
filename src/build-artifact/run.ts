import fs from 'fs';
// import * as core from '@actions/core';
// import * as github from '@actions/github';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import readline from 'readline';


export async function run(): Promise<void> {
  try {
    console.log('in action!!')
    const file = 'output.txt'
    await downloadFile("https://snooty-data-api.mongodb.com/projects/cloud-docs/master/documents", file);

    console.log('downloaded file, I guess')


    const documents: any[] = [];
    let metadata: any;

    await readline.createInterface({
        input: fs.createReadStream(file),
        terminal: false
    }).on('line', function(line: string) {
      const parsedLine = JSON.parse(line)
      if (parsedLine.type === 'page') {
        documents.push(parsedLine.data)
      } else if (parsedLine.type === 'metadata') {
        metadata = parsedLine.data;
      }
    }).on('close', function(){
      const writable = fs.createWriteStream('snooty-documents.js', {flags:'w'});
      writable.write(JSON.stringify(documents));
      const metadataWriter = fs.createWriteStream('snooty-metadata.js', {flags:'w'});
      metadataWriter.write(JSON.stringify(metadata));
    });

    console.log('now should git clone and run snooty...')



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
