CREATE OR REPLACE FUNCTION public.clear_conversation_messages(_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_conversation_participant(_conversation_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.messages
  WHERE conversation_id = _conversation_id;

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  RETURN _deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_conversation_messages(uuid) TO authenticated;