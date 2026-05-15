create table public.configuracao (
    id bigserial not null,
    fantasia varchar(120) not null,
    cnpj varchar(20) not null,
    email_suporte_contato varchar(180) not null,
    contato varchar(120) not null,
    disponibilidade varchar(40) default 'disponivel' not null,
    criado_em timestamptz default now() not null,
    atualizado_em timestamptz default now() not null,
    smtp_host text null,
    smtp_port text null,
    smtp_user text null,
    smtp_pass text null,
    smtp_from text null,
    constraint configuracao_pkey primary key (id)
);

create unique index configuracao_cnpj_unico_idx
    on public.configuracao using btree (cnpj);
