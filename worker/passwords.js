import {scryptAsync} from '@noble/hashes/scrypt.js';
// OWASP scrypt profile: N=2^14, r=8, p=5 (~16 MiB). Unique 128-bit salt;
// no plaintext password is persisted, logged or returned. Fixed parameters prevent downgrade.
const options={N:16384,r:8,p:5,dkLen:32,maxmem:32*1024*1024};
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function hashPassword(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){return {salt,hash:hex(await scryptAsync(password,salt,options)),algorithm:'scrypt-16384-8-5'}}
export async function checkPassword(password,stored){const result=await hashPassword(password,stored.salt);let diff=0;for(let i=0;i<64;i++)diff|=result.hash.charCodeAt(i)^stored.hash.charCodeAt(i);return diff===0}
