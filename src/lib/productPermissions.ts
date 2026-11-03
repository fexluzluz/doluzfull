export function canDeleteProduct(
  isAdmin: boolean,
  hasDeletePermission: boolean,
  clientId: string | null,
  productClientId: string,
) {
  return isAdmin || (hasDeletePermission && clientId !== null && clientId === productClientId);
}