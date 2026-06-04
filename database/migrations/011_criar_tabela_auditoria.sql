create table if not exists public.auditoria (
    id bigserial not null,

    acao varchar(20) not null,

    usuario_id bigint null,
    empresa_id bigint null,

    dados_antes jsonb null,
    dados_depois jsonb null,

    criado_em timestamptz default now() not null,

    constraint auditoria_pkey primary key (id),

    constraint auditoria_usuario_id_fkey
        foreign key (usuario_id)
        references public.usuarios (id)
        on delete set null,

    constraint auditoria_empresa_id_fkey
        foreign key (empresa_id)
        references public.empresas (id)
        on delete set null
);

create index if not exists auditoria_acao_idx
    on public.auditoria (acao);

create index if not exists auditoria_usuario_id_idx
    on public.auditoria (usuario_id);

create index if not exists auditoria_empresa_id_idx
    on public.auditoria (empresa_id);

create index if not exists auditoria_criado_em_idx
    on public.auditoria (criado_em);

--adiciona colunas aqui
alter table public.auditoria
    add column if not exists metodo_http varchar(10) null,
    add column if not exists rota varchar(255) null;

create index if not exists auditoria_metodo_http_idx
    on public.auditoria (metodo_http);

create index if not exists auditoria_rota_idx
    on public.auditoria (rota);
