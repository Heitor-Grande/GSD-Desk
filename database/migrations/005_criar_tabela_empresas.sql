-- public.empresas definição

-- Drop table

-- DROP TABLE public.empresas;

CREATE TABLE public.empresas (
	id bigserial NOT NULL,
	fantasia varchar(160) NOT NULL,
	cnpj varchar(14) NOT NULL,
	email varchar(180) NULL,
	telefone varchar(20) NULL,
	ativo bool DEFAULT true NOT NULL,
	criado_em timestamptz DEFAULT now() NOT NULL,
	atualizado_em timestamptz DEFAULT now() NOT NULL,
	criado_por int8 NOT NULL,
	atualizado_por int8 NULL,
	exigir_vinculo_produto bool DEFAULT false NOT NULL,
	suporte_visualiza_apenas_tickets_proprios bool DEFAULT false NOT NULL,
	superior_id int8 NULL,
	cliente_visualiza_apenas_tickets_proprios bool DEFAULT false NOT NULL,
	versao_token_api varchar(4) NULL,
	CONSTRAINT empresas_pkey PRIMARY KEY (id)
);
CREATE INDEX empresas_atualizado_por_idx ON public.empresas USING btree (atualizado_por);
CREATE UNIQUE INDEX empresas_cnpj_unico_idx ON public.empresas USING btree (cnpj);
CREATE INDEX empresas_criado_por_idx ON public.empresas USING btree (criado_por);


-- public.empresas chaves estrangeiras

ALTER TABLE public.empresas ADD CONSTRAINT empresas_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES public.usuarios(id);
ALTER TABLE public.empresas ADD CONSTRAINT empresas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);
ALTER TABLE public.empresas ADD CONSTRAINT empresas_superior_id_fkey FOREIGN KEY (superior_id) REFERENCES public.empresas(id);