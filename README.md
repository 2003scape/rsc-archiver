# rsc-archiver
compress and decompress runescape classic .jag/.mem cache files. these files
contain a proprietary header describing the size of the archive, and of
each individual entry (file). filenames are stored with a hash so it's
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
  rsc-archiver h <name>               return the integer hash of a filename stri
                                      ng                         [aliases: hash]

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]

Examples:
  rsc-archiver l ./cache/config85.jag       list the hashes in config85.jag
  rsc-archiver a ./cache/jagex.jag logo.tg  add logo.tga to jagex.jag
  a
```

## example
```javascript
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
```

## api
### hashFilename(filename)
convert `filename` to integer hash used in archives.

### archive = new JagArchive()
create a new jag (de)compressor instance.

### archive.entries
Map of hashes -> decompressed file buffers.

### archive.init()
initialize the bzip wasm.

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
Copyright 2022  2003Scape Team

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your option)
any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see http://www.gnu.org/licenses/.
