import { describe, expect, test } from 'bun:test';
import { canDeleteProduct } from './productPermissions';

describe('product deletion permissions', () => {
  const sulvendas = '6a6d1df3-08b1-4447-85e2-5e41bf4e3e83';
  const tn = 'eb10ccde-12fb-4eeb-b355-e93766604231';
  test('authorized Sulvendas account can delete its own products', () => {
    expect(canDeleteProduct(false, true, sulvendas, sulvendas)).toBe(true);
  });
  test('Sulvendas cannot delete TN products', () => {
    expect(canDeleteProduct(false, true, sulvendas, tn)).toBe(false);
  });
  test('other non-admin accounts remain unable to delete', () => {
    expect(canDeleteProduct(false, false, sulvendas, sulvendas)).toBe(false);
  });
  test('cannot delete before the client context loads', () => {
    expect(canDeleteProduct(false, true, null, sulvendas)).toBe(false);
  });
  test('admins retain product deletion permission', () => {
    expect(canDeleteProduct(true, false, null, tn)).toBe(true);
  });
});