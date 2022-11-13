import BZip2 from 'bzip2-wasm';

import JagBuffer from './jag-buffer.js';

// bzip block size (multiplies by 100k)
const BLOCK_SIZE = 1;

// BZ is a magic symbol, h is for huffman and 1 is the block size (from 1-9)
const BZIP_HEADER = new Uint8Array(
    ['B', 'Z', 'h', BLOCK_SIZE.toString()].map((c) => c.charCodeAt(0))
);

// maximum amount of files one archive can hold
const MAX_ENTRIES = 65535;

// maximum file size for overall cache or individual entries
const MAX_FILE_SIZE = 16777215;

// convert the desired file name to hash used in the archive index
function hashFilename(filename) {
    filename = filename.toUpperCase();

    let hash = 0;

    for (let i = 0; i < filename.length; i += 1) {
        hash = ((hash * 61) | 0) + filename.charCodeAt(i) - 32;
    }

    return hash;
}

class JagArchive {
    constructor() {
        // { fileHash: Buffer }
        this.entries = new Map();

        this.bzip2 = new BZip2();
    }

    async init() {
        await this.bzip2.init();
    }

    // add the bzip magic header and decompress it
    bzipDecompress(compressed, size) {
        const headered = new Uint8Array(BZIP_HEADER.length + compressed.length);

        headered.set(BZIP_HEADER);
        headered.set(compressed, BZIP_HEADER.length);

        return this.bzip2.decompress(headered, size);
    }

    // compress data remove the bzip magic header
    bzipCompress(data) {
        return this.bzip2.compress(data, BLOCK_SIZE).slice(BZIP_HEADER.length);
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
                this.bzipDecompress(this.zippedBuffer, this.size)
            );
        } else {
            this.unzippedBuffer = new JagBuffer(this.zippedBuffer);
        }
    }

    // populate the entries table
    readEntries() {
        this.entries.clear();

        const totalEntries = this.unzippedBuffer.getUShort();

        let offset = 2 + totalEntries * 10;

        for (let i = 0; i < totalEntries; i += 1) {
            const hash = this.unzippedBuffer.getInt4();
            const size = this.unzippedBuffer.getUInt3();

            const compressedSize = this.unzippedBuffer.getUInt3();

            const compressed = this.unzippedBuffer.data.slice(
                offset,
                offset + compressedSize
            );

            let decompressed;

            if (size !== compressedSize) {
                decompressed = this.bzipDecompress(compressed, size);
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

    hasEntry(name) {
        const hash = typeof name === 'number' ? name : hashFilename(name);

        return this.entries.has(hash);
    }

    // read a file from the decompressed archive
    getEntry(name) {
        if (!this.unzippedBuffer || !this.unzippedBuffer.data.length) {
            throw new Error('no decompressed data found');
        }

        const hash = typeof name === 'number' ? name : hashFilename(name);

        if (!this.hasEntry(hash)) {
            throw new Error(`entry ${name} (${hash}) not found`);
        }

        return this.entries.get(hash);
    }

    // add an entry to be compressed
    putEntry(filename, entry) {
        const hash = hashFilename(filename);
        this.entries.set(hash, entry);
    }

    // remove an entry by hash or filename (or throw if it doesn't exist)
    removeEntry(name) {
        const hash = typeof name === 'number' ? name : hashFilename(name);

        if (!this.entries.delete(hash)) {
            throw new Error(`entry ${name} (${hash}) not found`);
        }
    }

    // write the archive sizes
    writeHeader() {
        this.header = new JagBuffer(new Uint8Array(6));
        this.header.writeUInt3(this.unzippedBuffer.data.length);
        this.header.writeUInt3(this.zippedBuffer.length);
    }

    // compress the entire archive (if we didn't compress each file
    // individually)
    compress(individualCompress = true) {
        if (!individualCompress) {
            this.zippedBuffer = this.bzipCompress(this.unzippedBuffer.data);
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
            const compressed = individualCompress
                ? this.bzipCompress(entry)
                : entry;

            compressedEntries.set(hash, compressed);

            if (
                entry.length > MAX_FILE_SIZE ||
                compressed.length > MAX_FILE_SIZE
            ) {
                throw new RangeError(
                    `entry ${hash} is too big for archive (` +
                        `${entry.length > MAX_FILE_SIZE})`
                );
            }

            compressedSize += compressed.length;
        }

        // where we start storing the files
        let entryOffset = 2 + this.entries.size * 10;

        this.unzippedBuffer = new JagBuffer(
            new Uint8Array(entryOffset + compressedSize)
        );

        this.unzippedBuffer.writeUShort(this.entries.size);

        for (const [hash, compressedEntry] of compressedEntries) {
            this.unzippedBuffer.writeInt4(hash);
            this.unzippedBuffer.writeUInt3(this.entries.get(hash).length);
            this.unzippedBuffer.writeUInt3(compressedEntry.length);

            //compressedEntry.copy(this.unzippedBuffer.data, entryOffset);
            this.unzippedBuffer.data.set(compressedEntry, entryOffset);
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

        const headered = new Uint8Array(
            this.header.data.length + this.zippedBuffer.length
        );

        headered.set(this.header.data);
        headered.set(this.zippedBuffer, this.header.data.length);

        return headered;
    }

    toString() {
        return `[${this.constructor.name} (${this.entries.size})]`;
    }
}

export { hashFilename, JagArchive };
