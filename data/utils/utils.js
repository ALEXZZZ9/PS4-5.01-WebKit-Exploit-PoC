function u2d(low, hi) {
    if (!_dview) _dview = new DataView(new ArrayBuffer(8));
    _dview.setUint32(0, low, true);
    _dview.setUint32(4, hi, true);
    return _dview.getFloat64(0, true);
}

function paddr(lo, hi) {
    if (lo === undefined) return undefined;

    if (arguments.length === 1) {
        if (!Array.isArray(lo)) {
            return '0x' + ('00000000' + lo.toString(16)).slice(-8);
        } else {
            hi = lo[1];
            lo = lo[0];
        }
    }

    var slo = ('00000000' + lo.toString(16)).slice(-8);
    var shi = ('00000000' + hi.toString(16)).slice(-8);
    return '0x' + shi + slo;
}

function parseAddr(addr) {
    addr = "0000000000000000" + addr.replace('0x', '');
    addr = addr.slice(addr.length - 16);
    var arr = [addr.slice(0, 8), addr.slice(8, 16)];
    var hi = parseInt(arr[0], 16);
    var lo = parseInt(arr[1], 16);
    return [lo, hi];
}

function nullptr(addr) {
    return addr[0] === 0 && addr[1] === 0;
}

function eq(a, b) {
    return a[0] === b[0] && a[1] === b[1];
}

function add2(addr, off) {
    if (off === undefined) {
        throw new Error('off is undefined');
    } else if (typeof off === 'number') {
        if (off >= 0) {
            off = [off, 0];
        } else {
            off = [0xFFFFFFFF + off + 1 >>> 0, 0xFFFFFFFF];
        }
    }

    var alo = addr[0];
    var ahi = addr[1];
    var blo = off[0];
    var bhi = off[1];

    var nlo = (alo + blo & 0xFFFFFFFF) >>> 0;
    var nhi = (ahi + bhi & 0xFFFFFFFF) >>> 0;

    if (nlo < alo && blo > 0 || nlo === alo && blo !== 0) {
        nhi = (nhi + 1 & 0xFFFFFFFF) >>> 0;
    } else if (nlo > alo && blo < 0) {
        nhi = (nhi - 1 & 0xFFFFFFFF) >>> 0;
    }

    return [nlo, nhi];
}

function sub2(addr, off) {
    if (typeof off === 'number') {
        if (off >= 0) {
            off = [off, 0];
        } else {
            off = [0xFFFFFFFF + off + 1 >>> 0, 0xFFFFFFFF];
        }
    }

    off = add2([off[0] ^ 0xFFFFFFFF, off[1] ^ 0xFFFFFFFF], 1);
    return add2(addr, off);
}

function assertu32(num) {
    if (!Number.isInteger(num)) {
        throw new Error("expected integer");
    }
    if (num > 0xFFFFFFFF) {
        throw new Error("too large for u32");
    }
    if (num < 0) {
        throw new Error("expected positive integer");
    }
    return num;
}

function assertu64(arr) {
    if (!Array.isArray(arr)) {
        throw new Error("expected array");
    }
    if (arr.length !== 2) {
        throw new Error("expected [lo, hi] pair");
    }
    return [this.assertu32(arr[0]), this.assertu32(arr[1])];
}

function trunc32(num) {
    if (Array.isArray(num)) {
        if (num[1] !== 0) {
            throw new Error("high 32 bits must be clear");
        }
        return this.assertu32(num[0]);
    } else if (typeof num === "number") {
        return this.assertu32(num);
    } else {
        throw new Error("expected [lo,hi] or u32");
    }
}

// truncate to less than 32 bits, will always return number
// throw when truncating non-zero bits
function trunclt32(num, bits) {
    if (bits > 32) {
        throw new Error("can't truncate > 32 bits with trunclt32");
    }
    if (Array.isArray(num) && this.assertu64(num)) {
        if (num[1] !== 0) {
            throw new Error("high " + (64 - bits) + " bits must be clear");
        }
        num = this.assertu32(num[0]);
    } else if (typeof num === "number") {
        num = this.assertu32(num);
    } else {
        throw new Error("expected [lo,hi] or u32");
    }
    // for some reason, a >> 32 == a. that makes literally no sense.
    if (bits == 32 ? 0 : num >> bits > 0) {
        throw new Error("number is too large for " + bits + " bits");
    }
    return num;
}

// truncate to less than 64 bits, will always return [lo, hi]
// throw when truncating non-zero bits
function trunclt64(num, bits) {
    num = this.pad64(num);
    if (this.bits <= 32) {
        return [this.trunclt32(num), 0];
    }
    // for some reason, a >> 32 == a. that makes literally no sense.
    if (bits == 64 ? 0 : num[1] >> bits - 32 > 0) {
        throw new Error("number is too large for " + bits + " bits");
    }
    return num;
}

function pad64(num) {
    if (Array.isArray(num)) {
        return this.assertu64(num);
    } else if (typeof num === "number") {
        return [this.assertu32(num), 0];
    } else {
        throw new Error("expected [lo,hi] or number");
    }
}
