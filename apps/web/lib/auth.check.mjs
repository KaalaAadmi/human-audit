// Run: node lib/auth.check.mjs  (Node >= 23.6 strips the TS types in ./auth.ts)
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { verifyToken, clerkIssuer, authenticate } from './auth.ts';

const ISS = 'https://clerk.example.test';
const now = () => Math.floor(Date.now() / 1000);
const good = await generateKeyPair('RS256');
const attacker = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(good.publicKey)), alg: 'RS256', use: 'sig' }] });
const sign = (key, { iss = ISS, exp = now() + 60 } = {}) =>
  new SignJWT({}).setProtectedHeader({ alg: 'RS256' }).setSubject('user_1').setIssuer(iss).setIssuedAt().setExpirationTime(exp).sign(key);

assert.equal(await verifyToken(await sign(good.privateKey), keys, ISS), 'user_1', 'valid token');
assert.equal(await verifyToken(await sign(good.privateKey, { exp: now() - 60 }), keys, ISS), null, 'expired');
assert.equal(await verifyToken(await sign(good.privateKey, { iss: 'https://evil.test' }), keys, ISS), null, 'wrong issuer');
assert.equal(await verifyToken(await sign(attacker.privateKey), keys, ISS), null, 'signed with a different key');
assert.equal(await verifyToken('not.a.jwt', keys, ISS), null, 'garbage');

assert.equal(await authenticate(new Request('http://x')), null, 'no header');
assert.equal(clerkIssuer('pk_test_' + Buffer.from('foo.clerk.accounts.dev$').toString('base64')), 'https://foo.clerk.accounts.dev');

console.log('auth.check: ok');
