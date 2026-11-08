declare module 'pako' {
  export function inflate(data: any, options?: any): Uint8Array;
  export function inflateRaw(data: any, options?: any): Uint8Array;
  export function deflate(data: any, options?: any): Uint8Array;
  export function deflateRaw(data: any, options?: any): Uint8Array;
  const pako: {
    inflate: typeof inflate;
    inflateRaw: typeof inflateRaw;
    deflate: typeof deflate;
    deflateRaw: typeof deflateRaw;
  };
  export default pako;
}
