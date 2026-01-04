import { test } from 'node:test';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const publicDir = path.resolve('public');

test('Admin UI files exist', () => {
  const required = ['admin.html','css/admin.css','js/admin.js','logo.svg','manifest.json','sw.js','offline.html'];
  for (const f of required) {
    const p = path.join(publicDir, f);
    assert.ok(fs.existsSync(p), `${f} should exist`);
  }
});
