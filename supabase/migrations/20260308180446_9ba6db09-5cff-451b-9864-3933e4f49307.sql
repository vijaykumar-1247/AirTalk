ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.clear_conversation_messages(_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _updated_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_conversation_participant(_conversation_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.conversation_participants
  SET cleared_at = now()
  WHERE conversation_id = _conversation_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.clear_conversation_messages(uuid) TO authenticated;