create table public.usuarios (
    id bigserial not null,
    nome varchar(120) not null,
    email varchar(180) not null,
    senha_hash text not null,
    telefone varchar(20) null,
    documento varchar(20) null,
    perfil_id bigint null,
    ativo bool default true not null,
    criado_em timestamptz default now() not null,
    atualizado_em timestamptz default now() not null,
    salt text not null,
    "isAdmin" bool default false not null,
    constraint usuarios_pkey primary key (id)
);

create unique index usuarios_email_unico_idx
    on public.usuarios using btree (lower((email)::text));
