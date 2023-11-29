import { run } from '../src/comment-pr/run';

// Mock the action's entrypoint
jest.mock('../src/comment-pr/run', () => ({
  run: jest.fn()
}));

describe('index', () => {
  it('calls run when imported', async () => {
    require('../src/comment-pr');

    expect(run).toHaveBeenCalled();
  });
});
