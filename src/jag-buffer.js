function oobError() {
    return new RangeError('out of bounds');
}

class JagBuffer {
    constructor(data) {
        this.data = data;
        this.caret = 0;
    }

    getUByte() {
        if (this.caret + 1 > this.size) {
            throw oobError();
        }

        const out = this.data[this.caret] >>> 0;

        this.caret += 1;

        return out;
    }

    getUShort() {
        if (this.caret + 2 > this.size) {
            throw oobError();
        }

        let out = ((this.data[this.caret] & 0xff) << 8) >>> 0;
        out = (out | (this.data[this.caret + 1] & 0xff)) >>> 0;

        this.caret += 2;

        return out;
    }

    getUInt3() {
        if (this.caret + 3 > this.size) {
            throw oobError();
        }

        let out = ((this.data[this.caret] & 0xff) << 16) >>> 0;
        out = (out | ((this.data[this.caret + 1] & 0xff) << 8)) >>> 0;
        out = (out | (this.data[this.caret + 2] & 0xff)) >>> 0;

        this.caret += 3;

        return out;
    }

    getInt4() {
        if (this.caret + 4 > this.size) {
            throw oobError();
        }

        let out = ((this.data[this.caret] & 0xff) << 24);
        out = (out | ((this.data[this.caret + 1] & 0xff) << 16));
        out = (out | ((this.data[this.caret + 2] & 0xff) << 8));
        out = (out | (this.data[this.caret + 3] & 0xff));

        this.caret += 4;

        return out;
    }

    getBytes(length, start) {
        start = isNaN(+start) ? this.caret : start;

        const bytes = this.data.slice(start, start + length);
        this.caret += length;

        return bytes;
    }

    writeUByte(value) {
        this.data[this.caret] = value;
        this.caret += 1;
    }

    writeUShort(value) {
        this.data[this.caret] = (value >> 8) & 0xff;
        this.data[this.caret + 1] = value & 0xff;
        this.caret += 2;
    }

    writeUInt3(value) {
        this.data[this.caret] = (value >> 16) >>> 0;
        this.data[this.caret + 1] = (value >> 8) >>> 0;
        this.data[this.caret + 2] = value & 0xff;
        this.caret += 3;
    }

    writeInt4(value) {
        this.data[this.caret] = value >> 24;
        this.data[this.caret + 1] = value >> 16;
        this.data[this.caret + 2] = value >> 8;
        this.data[this.caret + 3] = value & 0xff;
        this.caret += 4;
    }

    writeBytes(bytes, start) {
        start = isNaN(+start) ? this.caret : start;
    }

    get size() {
        return this.data.byteLength;
    }
}

module.exports = JagBuffer;
