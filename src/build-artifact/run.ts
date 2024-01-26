import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import type * as streamWeb from 'node:stream/web';

/**
  Typescript necessary declaration:
  https://stackoverflow.com/questions/73308289/typescript-error-converting-a-native-fetch-body-webstream-to-a-node-stream
*/
declare global {
  interface Response {
    readonly body: streamWeb.ReadableStream<Uint8Array> | null;
  }
}

// These types are what's in the snooty manifest json file.
export type SnootyManifestEntry = {
  type: "page" | "timestamp" | "metadata" | "asset";
  data: unknown;
};

/**
  A node in the Snooty AST.
 */
type SnootyNode = {
  type: string;
  children?: (SnootyNode | SnootyTextNode)[];
  options?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
  A Snooty AST node with a text value.
 */
type SnootyTextNode = SnootyNode & {
  type: "text";
  children: never;
  value: string;
};

/**
  A page in the Snooty manifest.
 */
type SnootyPageData = {
  page_id: string;
  ast: SnootyNode;
  tags?: string[];
  deleted: boolean;
};

/**
 An Asset map by checksum 
 */
type Assets = {
  [checksum: string]: {
    checksum: string;
    assetData: string;
    filenames: string[];
  };
}


export async function run(): Promise<void> {
  try {
    const file = 'output.txt'
    /* Fetch Snooty project build data */
    await downloadSnootyProjectBuildData("https://snooty-data-api.mongodb.com/projects/cloud-docs/master/documents", file);

    let metadata: SnootyManifestEntry;
    const documents: SnootyPageData[] = [];
    const assets: Assets = {};

    /* Write each line to separate files in expected data structure for Snooty */
    readline.createInterface({
        input: fs.createReadStream(file),
        terminal: false
    }).on('line', function(lineString: string) {
      const line = JSON.parse(lineString);
      switch(line.type){
        case('page'): 
          documents.push(line.data);
          break;
        case('metadata'):
          metadata = line.data;
          break;
        case('asset'):
          assets[line.data.checksum] = line.data;
          break;
      }
    }).on('close', function(){
      const documentsWriter = fs.createWriteStream('snooty-documents.json');
      documentsWriter.write(JSON.stringify(documents));
      const metadataWriter = fs.createWriteStream('snooty-metadata.json');
      metadataWriter.write(JSON.stringify(metadata));
      const assetsWriter = fs.createWriteStream('snooty-assets.json');
      assetsWriter.write(JSON.stringify(assets));
    });
  } catch (error) {
    console.error('Error occurred when fetching and writing build data for cloud-docs', error);
    throw error;
  }
}

const downloadSnootyProjectBuildData = async (endpoint: string, targetFilename: string) => {
  const res = await fetch(endpoint);
  if (!res.body) return;
  const destination = path.resolve("./", targetFilename);
  const fileStream = fs.createWriteStream(destination);
  await finished(Readable.fromWeb(res.body!).pipe(fileStream));
};
