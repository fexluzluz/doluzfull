# Architecture rules

- Product deletion exceptions are validated by a protected database function and tenant-scoped RLS; the UI consumes that function instead of checking emails or granting admin status, so authorization cannot be bypassed in the browser.
- Product activation controls reuse the server-validated product management exception and scope updates by client ID; activation changes only the active flag to preserve sales history.