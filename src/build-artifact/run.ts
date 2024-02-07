import fs from 'fs';
import { createInterface } from 'readline';
import fetch from 'node-fetch';
import type * as streamWeb from 'node:stream/web';
import { once } from 'events';

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
  type: 'page' | 'timestamp' | 'metadata' | 'asset';
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
  type: 'text';
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
};

export async function run(): Promise<void> {
  try {
    const apiUrl = `https://snooty-data-api.mongodb.com/prod/projects/${process.env.PROJECT_TO_BUILD}/master/documents`;

    let metadata: SnootyManifestEntry | undefined;
    const documents: SnootyPageData[] = [];
    const assets: Assets = {};

    const { body } = await fetch(apiUrl);

    if (body === null) {
      throw new Error('No response body found');
    }

    /* Write each line to separate files in expected data structure for Snooty */
    const rl = createInterface({ input: body });

    rl.on('line', (lineString: string) => {
      const line = JSON.parse(lineString);
      switch (line.type) {
        case 'page':
          documents.push(line.data);
          break;
        case 'metadata':
          metadata = line.data;
          break;
        case 'asset':
          assets[line.data.checksum] = line.data.assetData;
          break;
      }
    });

    await once(rl, 'close');

    if (!metadata) {
      throw new Error('No metadata found');
    }

    const documentsWriter = fs.createWriteStream('snooty-documents.json');
    documentsWriter.write(JSON.stringify(documents));
    const metadataWriter = fs.createWriteStream('snooty-metadata.json');
    metadataWriter.write(JSON.stringify(metadata));

    fs.mkdirSync('assets', { recursive: true });
    for (const checksum in assets) {
      const assetsWriter = fs.createWriteStream(`assets/${checksum}`, {
        encoding: 'base64',
      });
      assetsWriter.write(assets[checksum]);
    }
  } catch (error) {
    console.error(
      `Error occurred when fetching and writing build data for ${process.env.PROJECT_TO_BUILD}`,
      error,
    );
    throw error;
  }
}
