create table if not exists public.usuarios_produtos (
    id bigserial not null,
    empresa_id bigint not null,
    usuario_id bigint not null,
    produto_id bigint not null,
    criado_em timestamptz default now() not null,
    criado_por bigint not null,
    constraint usuarios_produtos_pkey primary key (id),
    constraint usuarios_produtos_empresa_id_fkey foreign key (empresa_id) references public.empresas (id),
    constraint usuarios_produtos_usuario_id_fkey foreign key (usuario_id) references public.usuarios (id),
    constraint usuarios_produtos_produto_id_fkey foreign key (produto_id) references public.produtos (id) on delete cascade,
    constraint usuarios_produtos_criado_por_fkey foreign key (criado_por) references public.usuarios (id),
    constraint usuarios_produtos_empresa_usuario_produto_unico unique (empresa_id, usuario_id, produto_id)
);

create index if not exists usuarios_produtos_empresa_id_idx
    on public.usuarios_produtos using btree (empresa_id);

create index if not exists usuarios_produtos_usuario_id_idx
    on public.usuarios_produtos using btree (usuario_id);

create index if not exists usuarios_produtos_produto_id_idx
    on public.usuarios_produtos using btree (produto_id);
