import { readFile, writeFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';

const input = new URL('./export.xml', import.meta.url);
const xml = await readFile(input, { encoding: 'utf-8' });
const data = await parseStringPromise(xml);

const output = new URL('./export.json', import.meta.url);
await writeFile(output, JSON.stringify(data), { encoding: 'utf-8' });
