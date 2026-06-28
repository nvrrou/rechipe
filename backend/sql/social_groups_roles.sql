-- Run this once in Supabase SQL Editor before using the Social roles UI.
-- It keeps existing admins and migrates old "miembro" rows to "editor".

DO $$
DECLARE
  group_record record;
  new_code text;
BEGIN
  ALTER TABLE public.grupos ADD COLUMN IF NOT EXISTS codigo_grupo text;

  FOR group_record IN
    SELECT id FROM public.grupos WHERE codigo_grupo IS NULL
  LOOP
    LOOP
      new_code := upper(substr(md5(random()::text || clock_timestamp()::text || group_record.id::text), 1, 6));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.grupos WHERE codigo_grupo = new_code
      );
    END LOOP;

    UPDATE public.grupos
    SET codigo_grupo = new_code
    WHERE id = group_record.id;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.grupos'::regclass
      AND conname = 'grupos_codigo_grupo_key'
  ) THEN
    ALTER TABLE public.grupos
    ADD CONSTRAINT grupos_codigo_grupo_key UNIQUE (codigo_grupo);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.grupo_miembros') IS NOT NULL THEN
    ALTER TABLE public.grupo_miembros
    ADD COLUMN IF NOT EXISTS accepted boolean NOT NULL DEFAULT true;

    ALTER TABLE public.grupo_miembros
    DROP CONSTRAINT IF EXISTS grupo_miembros_rol_check;

    UPDATE public.grupo_miembros
    SET rol = 'editor'
    WHERE rol = 'miembro';

    ALTER TABLE public.grupo_miembros
    ALTER COLUMN rol SET DEFAULT 'espectador';

    ALTER TABLE public.grupo_miembros
    ADD CONSTRAINT grupo_miembros_rol_check
    CHECK (rol IN ('admin', 'editor', 'espectador'));
  END IF;

  IF to_regclass('public.miembros_grupo') IS NOT NULL THEN
    ALTER TABLE public.miembros_grupo
    ADD COLUMN IF NOT EXISTS accepted boolean NOT NULL DEFAULT true;

    ALTER TABLE public.miembros_grupo
    DROP CONSTRAINT IF EXISTS miembros_grupo_rol_check;

    UPDATE public.miembros_grupo
    SET rol = 'editor'
    WHERE rol = 'miembro';

    ALTER TABLE public.miembros_grupo
    ALTER COLUMN rol SET DEFAULT 'espectador';

    ALTER TABLE public.miembros_grupo
    ADD CONSTRAINT miembros_grupo_rol_check
    CHECK (rol IN ('admin', 'editor', 'espectador'));
  END IF;
END $$;
