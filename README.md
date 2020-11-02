# rsc-archiver
compress and decompress runescape classic .jag/.mem cache files. these files
contain a proprietary header describing the size of the archive, and of
each individual entry (file). filenames are stored with a "hash" so it's
impossible to recover the originals without bruteforcing (unless they're under
~5 characters).

this module works in the browser and node.

## install

    $ npm install @2003scape/rsc-archiver # -g for CLI program

## cli usage
```
rsc-archiver <command>

Commands:
  rsc-archiver x <archive> <files..>  extract a file from an archive
                                                              [aliases: extract]
  rsc-archiver a <archive> <files..>  add files to an archive     [aliases: add]
  rsc-archiver d <archive> <files..>  remove files from an archive
                                                               [aliases: delete]
  rsc-archiver l <archive>            list hashes and file sizes in an archive
                                                                 [aliases: list]
  rsc-archiver h <name>               return the integer hash of a filename
                                      string                     [aliases: hash]

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
```

## example
```javascript
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
```

## api
### archive.entries
Map of hashes -> decompressed file buffers.

### archive = new JagArchive()
create a new jag (de)compressor instance.

### archive.readArchive(buffer)
decompress buffer and populate entries with each file within.

### archive.hasEntry(name)
check if archive contains entry based on hash or filename.

### archive.getEntry(name)
return entry based on name or hash.

### archive.putEntry(name, buffer)
add a file to the archive buffer.

### archive.removeEntry(name)
remove entry based on name or hash.

### archive.toArchive(individualCompress=true)
compress entries to a jagex archive. if `individualCompress` is true, bzip each
file separately. otherwise, concatinate all of the files and then bzip
that result instead.

## license
Copyright 2020  2003Scape Team

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your option)
any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see http://www.gnu.org/licenses/.
