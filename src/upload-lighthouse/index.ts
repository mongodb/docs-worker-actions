/**
 * This action will need to be run after using a lhci command in a Github workflow.
 * That command write files to the specified file directory.
 * The structure and documentation of the outputted files can be found here: 
 * https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#outputdir
 
 * This action will read the manifest.json file, use this to sort the multiple Lighthouse runs of the same url/environment,
 * average the summaries together, read the html and json files of each, combine all of this into one document,
 * and finally upload this metadata on each macro-run to the appropriate Atlas collection.
 */
import fs from 'fs';
import { promisify } from 'util';
import { MongoClient } from 'mongodb';

import { Manifest } from './types';
import { DB_NAME, MAIN_COLL_NAME, PR_COLL_NAME } from './constants';
import { uploadHtmlToS3 } from './upload-to-s3';
import { createRunDocument, sortAndAverageRuns } from './helpers';

export const readFileAsync = promisify(fs.readFile);

async function main(): Promise<void> {
  const branch = process.env.BRANCH_NAME || '';

  try {
    const outputsFile = (
      await readFileAsync('./lhci/manifest.json')
    ).toString();

    const manifestsOfLighthouseRuns: Manifest[] = JSON.parse(outputsFile);

    /* Separate desktop from mobile manifests */
    const [desktopRunManifests, mobileRunManifests] =
      manifestsOfLighthouseRuns.reduce(
        (acc, cur) => {
          if (cur.url.includes('?desktop')) acc[0].push(cur);
          else acc[1].push(cur);
          return acc;
        },
        [[], []] as Manifest[][],
      );

    /* Average and summarize desktop runs */
    const desktopRuns = await sortAndAverageRuns(desktopRunManifests);
    const desktopRunDocuments = [];

    /* Construct full document for desktop runs */
    for (const desktopRun of desktopRuns) {
      desktopRunDocuments.push(createRunDocument(desktopRun, 'desktop'));
      await uploadHtmlToS3(desktopRun, 'desktop');
    }

    /* Average and summarize mobile runs */
    const mobileRuns = await sortAndAverageRuns(mobileRunManifests);
    const mobileRunDocuments = [];

    /* Construct full document for mobile runs */
    for (const mobileRun of mobileRuns) {
      mobileRunDocuments.push(createRunDocument(mobileRun, 'mobile'));
      await uploadHtmlToS3(mobileRun, 'mobile');
    }

    /* Merges to main branch are saved to a different collection than PR commits */
    const collectionName = branch === 'main' ? MAIN_COLL_NAME : PR_COLL_NAME;
    const client = new MongoClient(process.env.ATLAS_URI || '');
    const db = client.db(DB_NAME);

    console.log(
      `Uploading to Atlas DB ${DB_NAME} and Collection ${collectionName}...`,
    );
    const collection = db.collection(collectionName);
    await collection.insertMany([
      ...desktopRunDocuments,
      ...mobileRunDocuments,
    ]);

    console.log('Closing database connection');
    await client.close();
    return;
  } catch (error) {
    console.log('Error occurred when reading file', error);
    throw error;
  }
}

main();
