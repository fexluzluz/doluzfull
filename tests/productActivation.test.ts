import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canToggleProductActive } from '../src/lib/productPermissions';

describe('product activation permissions', () => {
  const sulvendas = '6a6d1df3-08b1-4447-85e2-5e41bf4e3e83';
  const tn = 'eb10ccde-12fb-4eeb-b355-e93766604231';
  test('Sul Vendas can inactivate its own products, regardless of sales history', () => {
    assert.equal(canToggleProductActive(false, true, sulvendas, sulvendas), true);
  });
  test('Sul Vendas cannot inactivate TN products', () => {
    assert.equal(canToggleProductActive(false, true, sulvendas, tn), false);
  });
  test('permission is required for non-admin accounts', () => {
    assert.equal(canToggleProductActive(false, false, sulvendas, sulvendas), false);
  });
  test('client context must be loaded', () => {
    assert.equal(canToggleProductActive(false, true, null, sulvendas), false);
  });
  test('admins retain activation permission', () => {
    assert.equal(canToggleProductActive(true, false, null, tn), true);
  });
});