create table if not exists public.ticket_mensagens_anexos (
    id bigserial not null,

    ticket_id bigint not null,

    mensagem_id bigint not null,

    nome_original varchar(255) not null,

    mime_type varchar(100) not null,

    extensao varchar(20),

    tamanho_bytes bigint not null,

    arquivo bytea not null,

    criado_em timestamptz default now() not null,

    criado_por bigint not null,

    constraint ticket_mensagens_anexos_pkey primary key (id),

    constraint ticket_mensagens_anexos_ticket_id_fkey
        foreign key (ticket_id)
        references public.tickets (id)
        on delete restrict,

    constraint ticket_mensagens_anexos_mensagem_id_fkey
        foreign key (mensagem_id)
        references public.ticket_mensagens (id)
        on delete cascade,

    constraint ticket_mensagens_anexos_criado_por_fkey
        foreign key (criado_por)
        references public.usuarios (id)
        on delete restrict,

    constraint ticket_mensagens_anexos_tamanho_chk
        check (tamanho_bytes <= 10485760)
);

create index if not exists ticket_mensagens_anexos_ticket_id_idx
    on public.ticket_mensagens_anexos (ticket_id);

create index if not exists ticket_mensagens_anexos_mensagem_id_idx
    on public.ticket_mensagens_anexos (mensagem_id);

create index if not exists ticket_mensagens_anexos_criado_por_idx
    on public.ticket_mensagens_anexos (criado_por);
