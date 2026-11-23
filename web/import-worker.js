import { readWorkspace } from './read-workspace.js';

self.onmessage = async ({ data: file }) => {
  try { self.postMessage({ report: await readWorkspace(file) }); }
  catch (error) { self.postMessage({ error: error.message || 'Couldn’t read this ZIP.' }); }
};
