create table if not exists public.empresas (
    id bigserial not null,
    fantasia varchar(160) not null,
    cnpj varchar(14) not null,
    email varchar(180) null,
    telefone varchar(20) null,
    ativo boolean default true not null,
    criado_em timestamptz default now() not null,
    atualizado_em timestamptz default now() not null,
    criado_por bigint not null,
    atualizado_por bigint null,
    constraint empresas_pkey primary key (id),
    constraint empresas_criado_por_fkey foreign key (criado_por) references public.usuarios (id),
    constraint empresas_atualizado_por_fkey foreign key (atualizado_por) references public.usuarios (id)
);

create unique index if not exists empresas_cnpj_unico_idx
    on public.empresas using btree (cnpj);

create index if not exists empresas_criado_por_idx
    on public.empresas using btree (criado_por);

create index if not exists empresas_atualizado_por_idx
    on public.empresas using btree (atualizado_por);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'usuarios_empresa_padrao_fkey'
    ) then
        alter table public.usuarios
            add constraint usuarios_empresa_padrao_fkey
            foreign key (empresa_padrao) references public.empresas (id);
    end if;
end $$;

create index if not exists usuarios_empresa_padrao_idx
    on public.usuarios using btree (empresa_padrao);
