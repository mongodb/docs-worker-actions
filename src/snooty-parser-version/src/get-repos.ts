import { MongoClient } from 'mongodb';
async function getClient() {
  const client = new MongoClient('');
}

/**
 * Get repos branches entries from atlas and verify owner by
 * using the GitHub API to search for the repo URL.
 */
export async function getRepos(): Promise<void> {
  return;
}
