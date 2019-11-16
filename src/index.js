const JagBuffer = require('./jag-buffer');
// we have to use this fork of compressjs as the main one has issues compiling
// with browserify and webpack
const { Bzip2 } = require('@ledgerhq/compressjs');

// BZ is a magic symbol, h is for huffman and 1 is the level of compression (
// from 1-9)
const BZIP_HEADER = Buffer.from(['B', 'Z', 'h', '1'].map(c => c.charCodeAt(0)));

// maximum amount of files one archive can hold
const MAX_ENTRIES = 65535;

// maximum file size for overall cache or individual entries
const MAX_FILE_SIZE = 16777215;

// convert the desired file name to hash used in the archive index
function hashFilename(filename) {
    filename = filename.toUpperCase();

    let hash = 0;

    for (let i = 0; i < filename.length; i += 1) {
        hash = (((hash * 61) | 0) + filename.charCodeAt(i)) - 32;
    }

    return hash;
}

// add the bzip magic header and decompress it
function bzipDecompress(compressed) {
    return Buffer.from(
        Bzip2.decompressFile(Buffer.concat([BZIP_HEADER, compressed])));
}

// compress data remove the bzip magic header
function bzipCompress(data) {
    return Buffer.from(Bzip2.compressFile(data, undefined, 1))
        .slice(BZIP_HEADER.length);
}

class JagArchive {
    constructor() {
        // { fileHash: Buffer }
        this.entries = new Map();
    }

    // read the archive sizes
    readHeader() {
        // this is the uncompressed size
        this.size = this.header.getUInt3();

        // this is the size of the compressed buffer + 6
        this.compressedSize = this.header.getUInt3();
    }

    // check if the entire archive needs to be decompressed
    decompress() {
        if (!this.zippedBuffer || !this.zippedBuffer.length) {
            throw new Error('no archive to decompress');
        }

        if (this.size !== this.compressedSize) {
            this.unzippedBuffer = new JagBuffer(
                bzipDecompress(this.zippedBuffer));
        } else {
            this.unzippedBuffer = new JagBuffer(this.zippedBuffer);
        }
    }

    // populate the entries table
    readEntries() {
        const totalEntries = this.unzippedBuffer.getUShort();

        let offset = 2 + totalEntries * 10;

        for (let i = 0; i < totalEntries; i += 1) {
            const hash = this.unzippedBuffer.getInt4();
            const size = this.unzippedBuffer.getUInt3();
            const compressedSize = this.unzippedBuffer.getUInt3();
            const compressed = this.unzippedBuffer.data.slice(
                offset, offset + compressedSize);

            let decompressed;

            if (size !== compressedSize) {
                decompressed = bzipDecompress(compressed);
            } else {
                decompressed = compressed;
            }

            this.entries.set(hash, decompressed);
            offset += compressedSize;
        }
    }

    // decompress the archive and populate our entries
    readArchive(buffer) {
        this.header = new JagBuffer(buffer.slice(0, 6));
        this.zippedBuffer = buffer.slice(6, buffer.length);

        this.readHeader();
        this.decompress();
        this.readEntries();
    }

    // read a file from the decompressed archive
    getEntry(filename) {
        const hash = hashFilename(filename);

        if (!this.unzippedBuffer || !this.unzippedBuffer.data.length) {
            throw new Error('no decompressed data found');
        }

        if (!this.entries.has(hash)) {
            throw new Error(`entry ${filename} (${hash}) not found`);
        }

        return this.entries.get(hash);
    }

    // add an entry to be compressed
    putEntry(filename, entry) {
        const hash = hashFilename(filename);
        this.entries.set(hash, entry);
    }

    // write the archive sizes
    writeHeader() {
        this.header = new JagBuffer(Buffer.alloc(6));
        this.header.writeUInt3(this.unzippedBuffer.size);
        this.header.writeUInt3(this.zippedBuffer.length);
    }

    // compress the entire archive (if we didn't compress each file
    // individually)
    compress(individualCompress = true) {
        if (!individualCompress) {
            this.zippedBuffer = bzipCompress(this.unzippedBuffer.data);
        } else {
            this.zippedBuffer = this.unzippedBuffer.data;
        }
    }

    // add each of the entries to the unzipped buffer
    writeEntries(individualCompress = true) {
        if (this.entries.length > MAX_ENTRIES) {
            throw new RangeError(`too many entries (${this.entries.length})`);
        }

        const compressedEntries = new Map();

        // the size of the concatinated compressed entries
        let compressedSize = 0;

        for (const [hash, entry] of this.entries) {
            const compressed = individualCompress ? bzipCompress(entry) : entry;
            compressedEntries.set(hash, compressed);

            if (entry.length > MAX_FILE_SIZE ||
                compressed.length > MAX_FILE_SIZE) {
                throw new RangeError(`entry ${hash} is too big for archive (` +
                    `${entry.length > MAX_FILE_SIZE})`);
            }

            compressedSize += compressed.length;
        }

        // where we start storing the files
        let entryOffset = 2 + this.entries.size * 10;

        this.unzippedBuffer = new JagBuffer(
            Buffer.alloc(entryOffset + compressedSize));

        this.unzippedBuffer.writeUShort(this.entries.size);

        for (const [hash, compressedEntry] of compressedEntries) {
            this.unzippedBuffer.writeInt4(hash);
            this.unzippedBuffer.writeUInt3(this.entries.get(hash).length);
            this.unzippedBuffer.writeUInt3(compressedEntry.length);

            compressedEntry.copy(this.unzippedBuffer.data, entryOffset);
            entryOffset += compressedEntry.length;
        }
    }

    // compress the entries to a properly formatted jagex archive. if
    // `individual` is enabled, each entry will be compressed individually
    // rather than compressing them together
    toArchive(individualCompress = true) {
        this.writeEntries(individualCompress);
        this.compress(individualCompress);
        this.writeHeader();

        return Buffer.concat([this.header.data, this.zippedBuffer]);
    }

    toString() {
        return `[object ${this.constructor.name} (${this.entries.size})]`;
    }
}

module.exports.hashFilename = hashFilename;
module.exports.JagArchive = JagArchive;
