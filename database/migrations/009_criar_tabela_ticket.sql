create table if not exists public.tickets (
    id bigserial not null,

    titulo varchar(50) not null,

    empresa_id bigint not null,
    produto_id bigint not null,

    responsavel_id bigint not null,
    agente_id bigint null,

    status varchar(30) not null,
    prioridade varchar(20) not null,

    criado_em timestamptz default now() not null,
    criado_por bigint not null,

    ultima_atualizacao_em timestamptz default now() not null,

    fechado_em timestamptz null,
    fechado_por bigint null,

    constraint tickets_pkey primary key (id),

    constraint tickets_empresa_id_fkey
        foreign key (empresa_id)
        references public.empresas (id)
        on delete restrict,

    constraint tickets_produto_id_fkey
        foreign key (produto_id)
        references public.produtos (id)
        on delete restrict,

    constraint tickets_responsavel_id_fkey
        foreign key (responsavel_id)
        references public.usuarios (id)
        on delete restrict,

    constraint tickets_agente_id_fkey
        foreign key (agente_id)
        references public.usuarios (id)
        on delete restrict,

    constraint tickets_criado_por_fkey
        foreign key (criado_por)
        references public.usuarios (id)
        on delete restrict,

    constraint tickets_fechado_por_fkey
        foreign key (fechado_por)
        references public.usuarios (id)
        on delete restrict
);

create index if not exists tickets_empresa_id_idx
    on public.tickets (empresa_id);

create index if not exists tickets_produto_id_idx
    on public.tickets (produto_id);

create index if not exists tickets_responsavel_id_idx
    on public.tickets (responsavel_id);

create index if not exists tickets_agente_id_idx
    on public.tickets (agente_id);

create index if not exists tickets_status_idx
    on public.tickets (status);

create index if not exists tickets_prioridade_idx
    on public.tickets (prioridade);

create index if not exists tickets_criado_em_idx
    on public.tickets (criado_em);
