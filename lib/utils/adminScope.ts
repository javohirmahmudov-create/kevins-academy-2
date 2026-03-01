export function getAdminIdFromRequest(request: Request): number | null {
  const rawAdminId = request.headers.get('x-admin-id');
  if (!rawAdminId) return null;
  const adminId = Number(rawAdminId);
  return Number.isFinite(adminId) && adminId > 0 ? adminId : null;
}
