import assert from 'node:assert/strict';
import test from 'node:test';

import { lessonScopeFilters, lessonScopeOrFilter } from './repository';

test('lesson scope values are quoted so an or-filter cannot add clauses', () => {
  assert.equal(
    lessonScopeOrFilter('brand', 'Honda),status.eq.proposed'),
    'scope->brand.is.null,scope->brand.eq."Honda),status.eq.proposed"',
  );
  assert.equal(
    lessonScopeOrFilter('region', 'a"b\\c'),
    'scope->region.is.null,scope->region.eq."a\\"b\\\\c"',
  );
  assert.equal(lessonScopeOrFilter('brand', '   '), null);
  assert.equal(lessonScopeOrFilter('region', 'x'.repeat(201)), null);
});

test('an unusable scope does not drop the null check or widen to every lesson', () => {
  assert.deepEqual(lessonScopeFilters({ brand: 'Honda),id.not.is.null' }), [
    'scope->brand.is.null,scope->brand.eq."Honda),id.not.is.null"',
  ]);
  assert.deepEqual(lessonScopeFilters({ brand: 'x'.repeat(201), region: 'Southeast' }), [
    'scope->brand.is.null',
    'scope->region.is.null,scope->region.eq."Southeast"',
  ]);
  assert.deepEqual(lessonScopeFilters({}), []);
});
