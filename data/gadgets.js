/* For storing the gadget and import map */
window.gadgetMap = [];
window.basicImportMap = [];

/* Simply adds given offset to given module's base address */
function getGadget(moduleName, offset) {
    return add2(window.ECore.moduleBaseAddresses[moduleName], offset);
}

/* All function stubs / imports from other modules */
var generateBasicImportMap = function() {
    window.basicImportMap = {
        '5.01': {
            'setjmp': getGadget('libSceWebKit2', 0x14F8), // setjmp imported from libkernel
            '__stack_chk_fail_ptr': getGadget('libSceWebKit2', 0x384BA40), // pointer to pointer to stack_chk_fail imported from libkernel -> look at epilogs to find this
            "sceKernelLoadStartModule": getGadget('libkernel', 0x31470), // dump libkernel using the stack_chk_fail pointer to find base, then look for _sceKernelLoadStartModule
        }
    };
}

/* All gadgets from the binary of available modules */
var generateGadgetMap = function() {
    window.gadgetMap = {
        '5.01': {
            'pop rsi': getGadget('libSceWebKit2', 0x0008f38a), // 0x000000000008f38a : pop rsi ; ret // 5ec3
            'pop rdi': getGadget('libSceWebKit2', 0x00038dba), // pop rdi ; ret
            'pop rax': getGadget('libSceWebKit2', 0x000043f5), // pop rax ; ret
            'pop rcx': getGadget('libSceWebKit2', 0x00052e59), // pop rcx ; ret
            'pop rdx': getGadget('libSceWebKit2', 0x000dedc2), // pop rdx ; ret
            'pop r8': getGadget('libSceWebKit2', 0x000179c5), // pop r8 ; ret
            'pop r9': getGadget('libSceWebKit2', 0x00bb30cf), // pop r9 ; ret
            'pop rsp': getGadget('libSceWebKit2', 0x0001e687), // pop rsp ; ret
            'push rax': getGadget('libSceWebKit2', 0x0017778e), // push rax ; ret  ;
            'mov rax, rdi': getGadget('libSceWebKit2', 0x000058d0), // mov rax, rdi ; ret
            'mov rax, rdx': getGadget('libSceWebKit2', 0x001cee60), // 0x00000000001cee60 : mov rax, rdx ; ret // 4889d0c3
            'add rax, rcx': getGadget('libSceWebKit2', 0x00015172), // add rax, rcx ; ret
            'mov qword ptr [rdi], rax': getGadget('libSceWebKit2', 0x0014536b), // mov qword ptr [rdi], rax ; ret 
            'mov qword ptr [rdi], rsi': getGadget('libSceWebKit2', 0x00023ac2), // mov qword ptr [rdi], rsi ; ret
            'mov rax, qword ptr [rax]': getGadget('libSceWebKit2', 0x0006c83a), // mov rax, qword ptr [rax] ; ret
            'ret': getGadget('libSceWebKit2', 0x0000003c), // ret  ;
            'nop': getGadget('libSceWebKit2', 0x00002f8f), // 0x0000000000002f8f : nop ; ret // 90c3

            'syscall': getGadget('libSceWebKit2', 0x2264DBC), // syscall  ; ret

            'jmp rax': getGadget('libSceWebKit2', 0x00000082), // jmp rax ;
            'jmp r8': getGadget('libSceWebKit2', 0x00201860), // jmp r8 ;
            'jmp r9': getGadget('libSceWebKit2', 0x001ce976), // jmp r9 ;
            'jmp r11': getGadget('libSceWebKit2', 0x0017e73a), // jmp r11 ;
            'jmp r15': getGadget('libSceWebKit2', 0x002f9f6d), // jmp r15 ;
            'jmp rbp': getGadget('libSceWebKit2', 0x001fb8bd), // jmp rbp ;
            'jmp rbx': getGadget('libSceWebKit2', 0x00039bd2), // jmp rbx ;
            'jmp rcx': getGadget('libSceWebKit2', 0x0000dee3), // jmp rcx ;
            'jmp rdi': getGadget('libSceWebKit2', 0x000b479c), // jmp rdi ;
            'jmp rdx': getGadget('libSceWebKit2', 0x0000e3d0), // jmp rdx ;
            'jmp rsi': getGadget('libSceWebKit2', 0x0002e004), // jmp rsi ;
            'jmp rsp': getGadget('libSceWebKit2', 0x0029e6ad), // jmp rsp ;

            // 0x013d1a00 : mov rdi, qword ptr [rdi] ; mov rax, qword ptr [rdi] ; mov rax, qword ptr [rax] ; jmp rax // 488b3f488b07488b00ffe0   
            // 0x00d65230: mov rdi, qword [rdi+0x18] ; mov rax, qword [rdi] ; mov rax, qword [rax+0x58] ; jmp rax ;  // 48 8B 7F 18 48 8B 07 48  8B 40 58 FF E0
            'jmp addr': getGadget('libSceWebKit2', 0x00d65230),
        }
    };
}