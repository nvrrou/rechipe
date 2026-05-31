-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.comentarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receta_id uuid,
  user_id uuid,
  contenido text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comentarios_pkey PRIMARY KEY (id),
  CONSTRAINT comentarios_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id),
  CONSTRAINT comentarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.despensa (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  grupo_id uuid,
  producto_id uuid,
  cantidad numeric,
  unidad text,
  precio_aprox numeric,
  fecha_vencimiento date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT despensa_pkey PRIMARY KEY (id),
  CONSTRAINT fk_despensa_grupo FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT despensa_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT despensa_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);
CREATE TABLE public.grupo_miembros (
  grupo_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rol text DEFAULT 'miembro'::text CHECK (rol = ANY (ARRAY['admin'::text, 'miembro'::text])),
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grupo_miembros_pkey PRIMARY KEY (grupo_id, user_id),
  CONSTRAINT grupo_miembros_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT grupo_miembros_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.grupos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  creado_por uuid,
  codigo_invitacion text DEFAULT "substring"(md5((random())::text), 1, 8) UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grupos_pkey PRIMARY KEY (id),
  CONSTRAINT grupos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.lista_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lista_id uuid,
  producto_id uuid,
  nombre text NOT NULL,
  cantidad numeric,
  unidad text,
  precio_estimado numeric,
  comprado boolean DEFAULT false,
  comprado_por uuid,
  comprado_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lista_items_pkey PRIMARY KEY (id),
  CONSTRAINT lista_items_lista_id_fkey FOREIGN KEY (lista_id) REFERENCES public.listas_compras(id),
  CONSTRAINT lista_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos_catalogo(id),
  CONSTRAINT lista_items_comprado_por_fkey FOREIGN KEY (comprado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.listas_compras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  grupo_id uuid,
  nombre text NOT NULL DEFAULT 'Lista de compras'::text,
  activa boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT listas_compras_pkey PRIMARY KEY (id),
  CONSTRAINT listas_compras_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_listas_grupo FOREIGN KEY (grupo_id) REFERENCES public.grupos(id)
);
CREATE TABLE public.plan_comidas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid,
  receta_id uuid,
  dia_semana integer NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 7),
  tipo_comida text NOT NULL,
  porciones integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plan_comidas_pkey PRIMARY KEY (id),
  CONSTRAINT plan_comidas_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id),
  CONSTRAINT plan_comidas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_semanales(id)
);
CREATE TABLE public.planes_semanales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  grupo_id uuid,
  nombre text DEFAULT 'Plan semanal'::text,
  semana_inicio date NOT NULL,
  presupuesto_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT planes_semanales_pkey PRIMARY KEY (id),
  CONSTRAINT fk_planes_grupo FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT planes_semanales_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT planes_semanales_presupuesto_id_fkey FOREIGN KEY (presupuesto_id) REFERENCES public.presupuestos(id)
);
CREATE TABLE public.precios_productos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  producto_id uuid,
  supermercado_id uuid,
  user_id uuid,
  precio numeric NOT NULL,
  unidad text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT precios_productos_pkey PRIMARY KEY (id),
  CONSTRAINT precios_productos_supermercado_id_fkey FOREIGN KEY (supermercado_id) REFERENCES public.supermercados(id),
  CONSTRAINT precios_productos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT precios_productos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);
CREATE TABLE public.presupuestos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  monto numeric NOT NULL,
  periodo text NOT NULL DEFAULT 'semanal'::text,
  moneda text NOT NULL DEFAULT 'CLP'::text,
  gastado numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT presupuestos_pkey PRIMARY KEY (id),
  CONSTRAINT presupuestos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.productos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  producto_catalogo_id uuid,
  nombre text NOT NULL,
  codigo_barra text,
  categoria text,
  marca text,
  imagen_url text,
  energia_kcal text,
  proteinas_g numeric,
  carbohidratos_g numeric,
  grasas_totales_g numeric,
  fibra_g numeric,
  sodio_mg numeric,
  azucares_totales_g numeric,
  es_personalizado boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT productos_pkey PRIMARY KEY (id),
  CONSTRAINT productos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT productos_producto_catalogo_id_fkey FOREIGN KEY (producto_catalogo_id) REFERENCES public.productos_catalogo(id)
);
CREATE TABLE public.productos_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL,
  solicitado_por uuid NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'aprobado'::text, 'rechazado'::text])),
  comentario_revision text,
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT productos_auth_pkey PRIMARY KEY (id),
  CONSTRAINT productos_auth_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT productos_auth_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES auth.users(id),
  CONSTRAINT productos_auth_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.productos_catalogo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo_barra text UNIQUE,
  categoria text,
  marca text,
  imagen_url text,
  energia_kcal numeric,
  proteinas_g numeric,
  carbohidratos_g numeric,
  grasas_g numeric,
  fibra_g numeric,
  sodio_mg numeric,
  azucar_g numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT productos_catalogo_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nombre text NOT NULL,
  email text,
  avatar_url text,
  edad integer,
  peso_kg numeric,
  altura_cm integer,
  genero text,
  objetivos jsonb,
  restricciones jsonb DEFAULT '[]'::jsonb,
  ingredientes_favoritos ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.recetas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creado_por uuid,
  grupo_id uuid,
  titulo text NOT NULL,
  descripcion text,
  instrucciones text,
  ingredientes jsonb DEFAULT '[]'::jsonb,
  info_nutricional jsonb DEFAULT '{}'::jsonb,
  tiempo_preparacion integer,
  porciones integer DEFAULT 1,
  costo_estimado numeric,
  es_publica boolean DEFAULT false,
  generada_por_ia boolean DEFAULT true,
  prompt_usado text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recetas_pkey PRIMARY KEY (id),
  CONSTRAINT fk_recetas_grupo FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT recetas_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.recetas_favoritas (
  user_id uuid NOT NULL,
  receta_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recetas_favoritas_pkey PRIMARY KEY (user_id, receta_id),
  CONSTRAINT recetas_favoritas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT recetas_favoritas_receta_id_fkey FOREIGN KEY (receta_id) REFERENCES public.recetas(id)
);
CREATE TABLE public.supermercados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  cadena text,
  direccion text,
  latitud numeric,
  longitud numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT supermercados_pkey PRIMARY KEY (id)
);