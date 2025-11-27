// Type declarations for modules without built-in types

declare module 'crypto-js' {
    const CryptoJS: any;
    export = CryptoJS;
}

declare module 'crypto-js/aes' {
    const AES: any;
    export = AES;
}

declare module 'crypto-js/enc-utf8' {
    const Utf8: any;
    export = Utf8;
}
