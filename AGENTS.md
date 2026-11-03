# Architecture rules

- Product deletion exceptions are validated by a protected database function and tenant-scoped RLS; the UI consumes that function instead of checking emails or granting admin status, so authorization cannot be bypassed in the browser.