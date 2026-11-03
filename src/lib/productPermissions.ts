export function canDeleteProduct(
  isAdmin: boolean,
  hasDeletePermission: boolean,
  clientId: string | null,
  productClientId: string,
) {
  return isAdmin || (hasDeletePermission && clientId !== null && clientId === productClientId);
}

export function canToggleProductActive(
  isAdmin: boolean,
  hasManagePermission: boolean,
  clientId: string | null,
  productClientId: string,
) {
  return isAdmin || (hasManagePermission && clientId !== null && clientId === productClientId);
}