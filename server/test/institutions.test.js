import test from 'node:test';
import assert from 'node:assert/strict';
import { institutionCreateSchema, invitationCreateSchema, memberUpdateSchema } from '../institutionSchemas.js';
import { hasInstitutionRole, parseNumericId, slugify } from '../institutionAccess.js';

test('az intézménynév és slug biztonságosan normalizálható', () => {
  assert.equal(institutionCreateSchema.safeParse({ name: 'Minta Iskola' }).success, true);
  assert.equal(slugify('Árvíztűrő Tükörfúrógép!'), 'arvizturo-tukorfurogep');
  assert.equal(parseNumericId('42'), '42');
  assert.equal(parseNumericId('42 OR 1=1'), null);
});

test('az intézményi szerepkör mindig tagsághoz kötött', () => {
  assert.equal(hasInstitutionRole({ role: 'teacher' }, ['owner', 'admin', 'teacher']), true);
  assert.equal(hasInstitutionRole({ role: 'student' }, ['owner', 'admin', 'teacher']), false);
});

test('emailes meghíváshoz email szükséges', () => {
  const invalid = invitationCreateSchema.safeParse({ kind: 'email', role: 'student', maxUses: 1, expiresInDays: 14 });
  const valid = invitationCreateSchema.safeParse({ kind: 'email', email: 'diak@example.com', role: 'student', maxUses: 1, expiresInDays: 14 });
  assert.equal(invalid.success, false);
  assert.equal(valid.success, true);
});

test('csak kódos meghívás lehet többször használható', () => {
  assert.equal(invitationCreateSchema.safeParse({ kind: 'link', role: 'student', maxUses: 20, expiresInDays: 14 }).success, false);
  assert.equal(invitationCreateSchema.safeParse({ kind: 'code', role: 'student', maxUses: 20, expiresInDays: 14 }).success, true);
});

test('a tulajdonosi szerep tagsági frissítéssel nem osztható ki', () => {
  assert.equal(memberUpdateSchema.safeParse({ role: 'owner' }).success, false);
  assert.equal(memberUpdateSchema.safeParse({ role: 'admin' }).success, true);
});
