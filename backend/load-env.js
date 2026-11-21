import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));

function loadMissingEnvironment(filePath) {
  try {
    const values = dotenv.parse(fs.readFileSync(filePath));
    for (const [key, value] of Object.entries(values)) {
      if (!process.env[key]?.trim()) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

loadMissingEnvironment(path.resolve(backendDirectory, '..', '.env.local'));
loadMissingEnvironment(path.join(backendDirectory, '.env'));
