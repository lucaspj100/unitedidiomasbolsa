REVOKE EXECUTE ON FUNCTION public.complete_vendedor_password_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_vendedor_password_change() FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_vendedor_password_change() TO authenticated;