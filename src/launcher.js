#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

// The installed command uses this checkout's configuration and artifacts.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await import('./cli.js');
