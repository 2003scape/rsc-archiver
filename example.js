import fs from 'fs/promises';
import { JagArchive } from './src/index.js';

const archive = new JagArchive();
await archive.init();
archive.readArchive(await fs.readFile('./cache/sounds1.mem'));

console.log(`cache has ${archive.entries.size} files`);

// get death.pcm from the archive and write it to disk
await fs.writeFile('death.pcm', archive.getEntry('death.pcm'));

// create a new archive and add a text file to it
archive.entries.clear();
archive.putEntry('test.txt', Buffer.from('test string'));
await fs.writeFile('./cache/test.jag', archive.toArchive(true));

// read the new archive and retrive the file from it
archive.readArchive(await fs.readFile('./cache/test.jag'))

console.log(`cache has ${archive.entries.size} files`);
console.log(Buffer.from(archive.getEntry('test.txt')).toString());
