CREATE OR REPLACE FUNCTION public.complete_vendedor_password_change()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  UPDATE public.vendedores
     SET must_change_password = false,
         updated_at = now()
   WHERE user_id = auth.uid()
     AND ativo = true;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_vendedor_password_change() TO authenticated;