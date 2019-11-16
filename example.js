const fs = require('fs');
const { JagArchive } = require('./src');

let rawJag = fs.readFileSync('./data204/sounds1.mem');
let archive = new JagArchive();
archive.readArchive(rawJag);
console.log(`cache has ${archive.entries.size} files`);
fs.writeFileSync('death.pcm', archive.getEntry('death.pcm'));

const testArchive = new JagArchive();
testArchive.putEntry('test.txt', Buffer.from('test string'));
fs.writeFileSync('./data204/test.jag', testArchive.toArchive(true));

rawJag = fs.readFileSync('./data204/test.jag');
archive = new JagArchive();
archive.readArchive(rawJag);
console.log(`cache has ${archive.entries.size} files`);
console.log(archive.getEntry('test.txt').toString());
