import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canDeleteProduct } from './productPermissions';

describe('product deletion permissions', () => {
  const sulvendas = '6a6d1df3-08b1-4447-85e2-5e41bf4e3e83';
  const tn = 'eb10ccde-12fb-4eeb-b355-e93766604231';
  test('authorized Sulvendas account can delete its own products', () => {
    assert.equal(canDeleteProduct(false, true, sulvendas, sulvendas), true);
  });
  test('Sulvendas cannot delete TN products', () => {
    assert.equal(canDeleteProduct(false, true, sulvendas, tn), false);
  });
  test('other non-admin accounts remain unable to delete', () => {
    assert.equal(canDeleteProduct(false, false, sulvendas, sulvendas), false);
  });
  test('cannot delete before the client context loads', () => {
    assert.equal(canDeleteProduct(false, true, null, sulvendas), false);
  });
  test('admins retain product deletion permission', () => {
    assert.equal(canDeleteProduct(true, false, null, tn), true);
  });
});