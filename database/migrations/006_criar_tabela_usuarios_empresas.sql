create table if not exists public.usuarios_empresas (
    id bigserial not null,
    usuario_id bigint not null,
    empresa_id bigint not null,
    criado_em timestamptz default now() not null,
    criado_por bigint not null,
    constraint usuarios_empresas_pkey primary key (id),
    constraint usuarios_empresas_usuario_id_fkey foreign key (usuario_id) references public.usuarios (id),
    constraint usuarios_empresas_empresa_id_fkey foreign key (empresa_id) references public.empresas (id),
    constraint usuarios_empresas_criado_por_fkey foreign key (criado_por) references public.usuarios (id),
    constraint usuarios_empresas_usuario_empresa_unico unique (usuario_id, empresa_id)
);

create index if not exists usuarios_empresas_usuario_id_idx
    on public.usuarios_empresas using btree (usuario_id);

create index if not exists usuarios_empresas_empresa_id_idx
    on public.usuarios_empresas using btree (empresa_id);
