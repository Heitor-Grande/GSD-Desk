create table if not exists public.ticket_mensagens (
    id bigserial not null,

    ticket_id bigint not null,

    conteudo text not null,

    enviado_por bigint not null,

    enviado_em timestamptz default now() not null,

    constraint ticket_mensagens_pkey primary key (id),

    constraint ticket_mensagens_ticket_id_fkey
        foreign key (ticket_id)
        references public.tickets (id)
        on delete restrict,

    constraint ticket_mensagens_enviado_por_fkey
        foreign key (enviado_por)
        references public.usuarios (id)
        on delete restrict
);

create index if not exists ticket_mensagens_ticket_id_idx
    on public.ticket_mensagens (ticket_id);

create index if not exists ticket_mensagens_enviado_por_idx
    on public.ticket_mensagens (enviado_por);

create index if not exists ticket_mensagens_enviado_em_idx
    on public.ticket_mensagens (enviado_em);