import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTicketId, inferCommitType } from './branchParser.js';

test('extractTicketId should correctly extract typical ticket IDs', () => {
    assert.strictEqual(extractTicketId('feature/CPAD-1234-login'), 'CPAD-1234');
    assert.strictEqual(extractTicketId('bugfix/proj-12-crash'), 'PROJ-12');
    assert.strictEqual(extractTicketId('fix/TEST-99-fix-typo'), 'TEST-99');
    assert.strictEqual(extractTicketId('CPAD-01-dashboard'), 'CPAD-01');
});

test('extractTicketId should return None when no ticket ID is present', () => {
    assert.strictEqual(extractTicketId('feature/user-login'), 'None');
    assert.strictEqual(extractTicketId('main'), 'None');
    assert.strictEqual(extractTicketId('bugfix-minor-issue'), 'None');
});

test('inferCommitType should infer type from branch prefix with slash', () => {
    assert.strictEqual(inferCommitType('feature/user-login'), 'feat');
    assert.strictEqual(inferCommitType('feat/CPAD-123'), 'feat');
    assert.strictEqual(inferCommitType('bugfix/CPAD-124'), 'fix');
    assert.strictEqual(inferCommitType('bug/crash'), 'fix');
    assert.strictEqual(inferCommitType('fix/typo'), 'fix');
    assert.strictEqual(inferCommitType('hotfix/prod-issue'), 'fix');
    assert.strictEqual(inferCommitType('chore/update-deps'), 'chore');
});

test('inferCommitType should infer type from branch prefix with dash', () => {
    assert.strictEqual(inferCommitType('feature-user-login'), 'feat');
    assert.strictEqual(inferCommitType('bugfix-CPAD-124'), 'fix');
    assert.strictEqual(inferCommitType('chore-update-deps'), 'chore');
});

test('inferCommitType should return None for unrecognized prefixes', () => {
    assert.strictEqual(inferCommitType('CPAD-1234-login'), 'None');
    assert.strictEqual(inferCommitType('main'), 'None');
    assert.strictEqual(inferCommitType('random-branch-name'), 'None');
});
