create table if not exists public.perfil (
    id bigserial not null,
    nome varchar(120) not null,
    descricao varchar(240) null,
    ativo bool default true not null,
    permissoes jsonb not null,
    criado_em timestamptz default now() not null,
    atualizado_em timestamptz default now() not null,
    constraint perfil_pkey primary key (id)
);

create unique index if not exists perfil_nome_unico_idx
    on public.perfil using btree (lower((nome)::text));

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'usuarios_perfil_id_fkey'
    ) then
        alter table public.usuarios
            add constraint usuarios_perfil_id_fkey
            foreign key (perfil_id)
            references public.perfil (id);
    end if;
end $$;
