create table if not exists public.produtos (
    id bigserial not null,
    empresa_id bigint not null,
    nome varchar(150) not null,
    descricao text null,
    ativo bool default true not null,
    criado_em timestamp default current_timestamp not null,
    criado_por bigint not null,
    atualizado_em timestamp null,
    constraint produtos_pkey primary key (id),
    constraint produtos_empresa_id_fkey foreign key (empresa_id) references public.empresas (id),
    constraint produtos_criado_por_fkey foreign key (criado_por) references public.usuarios (id)
);

create index if not exists produtos_empresa_id_idx
    on public.produtos using btree (empresa_id);

create index if not exists produtos_ativo_idx
    on public.produtos using btree (ativo);

create index if not exists produtos_criado_por_idx
    on public.produtos using btree (criado_por);

create unique index if not exists produtos_empresa_nome_unico_idx
    on public.produtos using btree (empresa_id, lower((nome)::text));
