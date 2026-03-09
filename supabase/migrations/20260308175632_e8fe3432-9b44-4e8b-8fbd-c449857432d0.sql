ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reaction_emoji text;

CREATE OR REPLACE FUNCTION public.set_message_reaction(_message_id uuid, _emoji text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conversation_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.conversation_id
  INTO _conversation_id
  FROM public.messages m
  WHERE m.id = _message_id;

  IF _conversation_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_conversation_participant(_conversation_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.messages
  SET reaction_emoji = NULLIF(trim(_emoji), '')
  WHERE id = _message_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_message_reaction(uuid, text) TO authenticated;