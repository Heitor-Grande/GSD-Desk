# Migrations

Execute os scripts em ordem crescente pelo prefixo numérico. Esta pasta contém as migrations PostgreSQL do projeto.

## Ordem de execução

1. `001_criar_tabela_usuarios.sql`
2. `002_criar_tabela_configuracao.sql`
3. `004_criar_tabela_perfil.sql`
4. `005_criar_tabela_empresas.sql`
5. `006_criar_tabela_usuarios_empresas.sql`
6. `007_criar_tabela_produtos.sql`
7. `008_criar_tabela_usuarios_produtos.sql`

## Tabela `usuarios`

Criada por `001_criar_tabela_usuarios.sql`.

Campos:

- `id`: chave primária.
- `nome`: nome do usuário.
- `email`: e-mail do usuário.
- `senha_hash`: hash da senha.
- `telefone`: telefone opcional.
- `documento`: documento opcional.
- `perfil_id`: perfil opcional do usuário.
- `empresa_padrao`: empresa padrão opcional do usuário.
- `ativo`: status do usuário.
- `criado_em`: data de criação.
- `atualizado_em`: data da última atualização.
- `salt`: salt usado na senha.
- `isAdmin`: indica usuário administrador.

Índices e relacionamentos:

- `usuarios_pkey`: chave primária em `id`.
- `usuarios_email_unico_idx`: índice único para `lower(email)`.
- `usuarios_perfil_id_fkey`: FK de `perfil_id` para `perfil.id`, adicionada em `004_criar_tabela_perfil.sql`.
- `usuarios_empresa_padrao_fkey`: FK de `empresa_padrao` para `empresas.id`, adicionada em `005_criar_tabela_empresas.sql`.
- `usuarios_empresa_padrao_idx`: índice para consultas por empresa padrão.

## Tabela `configuracao`

Criada por `002_criar_tabela_configuracao.sql`.

Campos:

- `id`: chave primária.
- `fantasia`: nome de exibição.
- `cnpj`: CNPJ da configuração.
- `email_suporte_contato`: e-mail de suporte.
- `contato`: contato principal.
- `disponibilidade`: status de disponibilidade, com padrão `disponivel`.
- `criado_em`: data de criação.
- `atualizado_em`: data da última atualização.
- `smtp_host`: host SMTP opcional.
- `smtp_port`: porta SMTP opcional.
- `smtp_user`: usuário SMTP opcional.
- `smtp_pass`: senha SMTP opcional.
- `smtp_from`: remetente SMTP opcional.

Índices:

- `configuracao_pkey`: chave primária em `id`.
- `configuracao_cnpj_unico_idx`: índice único para `cnpj`.

## Tabela `perfil`

Criada por `004_criar_tabela_perfil.sql`.

Campos:

- `id`: chave primária.
- `nome`: nome do perfil.
- `descricao`: descrição opcional.
- `ativo`: status do perfil.
- `permissoes`: permissões em JSON.
- `criado_em`: data de criação.
- `atualizado_em`: data da última atualização.

Índices e relacionamentos:

- `perfil_pkey`: chave primária em `id`.
- `perfil_nome_unico_idx`: índice único para `lower(nome)`.
- `usuarios_perfil_id_fkey`: FK adicionada em `usuarios.perfil_id`.

## Tabela `empresas`

Criada por `005_criar_tabela_empresas.sql`.

Campos:

- `id`: chave primária.
- `fantasia`: nome fantasia da empresa.
- `cnpj`: CNPJ da empresa com 14 dígitos.
- `email`: e-mail opcional.
- `telefone`: telefone opcional.
- `ativo`: status da empresa.
- `exigir_vinculo_produto`: define se usuários de suporte precisam estar vinculados aos produtos da empresa.
- `suporte_visualiza_apenas_tickets_proprios`: define se usuários de suporte visualizam apenas tickets atribuídos a eles na empresa.
- `criado_em`: data de criação.
- `atualizado_em`: data da última atualização.
- `criado_por`: usuário que criou a empresa.
- `atualizado_por`: usuário da última atualização.

Índices e relacionamentos:

- `empresas_pkey`: chave primária em `id`.
- `empresas_criado_por_fkey`: FK de `criado_por` para `usuarios.id`.
- `empresas_atualizado_por_fkey`: FK de `atualizado_por` para `usuarios.id`.
- `empresas_cnpj_unico_idx`: índice único para `cnpj`.
- `empresas_criado_por_idx`: índice para `criado_por`.
- `empresas_atualizado_por_idx`: índice para `atualizado_por`.

## Tabela `usuarios_empresas`

Criada por `006_criar_tabela_usuarios_empresas.sql`.

Campos:

- `id`: chave primária.
- `usuario_id`: usuário vinculado.
- `empresa_id`: empresa vinculada.
- `criado_em`: data de criação do vínculo.
- `criado_por`: usuário que criou o vínculo.

Índices e relacionamentos:

- `usuarios_empresas_pkey`: chave primária em `id`.
- `usuarios_empresas_usuario_id_fkey`: FK de `usuario_id` para `usuarios.id`.
- `usuarios_empresas_empresa_id_fkey`: FK de `empresa_id` para `empresas.id`.
- `usuarios_empresas_criado_por_fkey`: FK de `criado_por` para `usuarios.id`.
- `usuarios_empresas_usuario_empresa_unico`: constraint única para `usuario_id` + `empresa_id`.
- `usuarios_empresas_usuario_id_idx`: índice para `usuario_id`.
- `usuarios_empresas_empresa_id_idx`: índice para `empresa_id`.

## Regra de vínculo usuário/empresa

A tabela `usuarios_empresas` representa apenas vínculos existentes. Não há campo `ativo` e não há campo `atualizado_em` nessa tabela. Para remover um vínculo, o registro deve ser excluído fisicamente.

O campo `usuarios.empresa_padrao` guarda a empresa padrão opcional do usuário. Quando um vínculo é criado e o usuário não possui empresa padrão, a empresa vinculada pode ser definida como padrão. Quando o vínculo da empresa padrão é removido, a aplicação deve escolher outra empresa vinculada ou definir `empresa_padrao` como `null` quando não houver outro vínculo.

## Tabela `produtos`

Criada por `007_criar_tabela_produtos.sql`.

Campos:

- `id`: chave primária.
- `empresa_id`: empresa vinculada ao produto.
- `nome`: nome do produto.
- `descricao`: descrição opcional.
- `ativo`: status do produto.
- `criado_em`: data de criação.
- `criado_por`: usuário que criou o produto.
- `atualizado_em`: data da última atualização.

Índices e relacionamentos:

- `produtos_pkey`: chave primária em `id`.
- `produtos_empresa_id_fkey`: FK de `empresa_id` para `empresas.id`.
- `produtos_criado_por_fkey`: FK de `criado_por` para `usuarios.id`.
- `produtos_empresa_id_idx`: índice para `empresa_id`.
- `produtos_ativo_idx`: índice para `ativo`.
- `produtos_criado_por_idx`: índice para `criado_por`.
- `produtos_empresa_nome_unico_idx`: índice único para evitar nomes duplicados dentro da mesma empresa.
## Tabela `usuarios_produtos`

Criada por `008_criar_tabela_usuarios_produtos.sql`.

Objetivo:

- Representar quais usuários vinculados a uma empresa também estão vinculados a produtos específicos dessa empresa.
- Apoiar a regra operacional futura de atendimento restrito por produto quando `empresas.exigir_vinculo_produto` estiver habilitado.

Campos:

- `id`: chave primária.
- `empresa_id`: empresa do contexto do vínculo.
- `usuario_id`: usuário vinculado ao produto.
- `produto_id`: produto vinculado ao usuário.
- `criado_em`: data de criação do vínculo.
- `criado_por`: usuário que criou o vínculo.

Índices e relacionamentos:

- `usuarios_produtos_pkey`: chave primária em `id`.
- `usuarios_produtos_empresa_id_fkey`: FK de `empresa_id` para `empresas.id`.
- `usuarios_produtos_usuario_id_fkey`: FK de `usuario_id` para `usuarios.id`.
- `usuarios_produtos_produto_id_fkey`: FK de `produto_id` para `produtos.id`, com remoção em cascata quando o produto for excluído.
- `usuarios_produtos_criado_por_fkey`: FK de `criado_por` para `usuarios.id`.
- `usuarios_produtos_empresa_usuario_produto_unico`: constraint única para impedir duplicidade de vínculo entre a mesma empresa, usuário e produto.
- `usuarios_produtos_empresa_id_idx`: índice para `empresa_id`.
- `usuarios_produtos_usuario_id_idx`: índice para `usuario_id`.
- `usuarios_produtos_produto_id_idx`: índice para `produto_id`.

## Regra de vínculo usuário/produto

A tabela `usuarios_produtos` representa apenas vínculos existentes. Não há campo `ativo` e não há campo `atualizado_em`; para remover um vínculo, o registro deve ser excluído fisicamente.

## Tabela `tickets`

Criada por `009_criar_tabela_tickets.sql`.

A tabela `tickets` armazena as informações gerais dos chamados/tickets do sistema.

Campos:

- `id`: chave primária.
- `empresa_id`: empresa vinculada ao ticket.
- `produto_id`: produto vinculado ao ticket.
- `responsavel_id`: usuário responsável pelo ticket.
- `agente_id`: usuário agente do ticket, opcional.
- `status`: status atual do ticket com até 20 caracteres.
- `prioridade`: prioridade do ticket com até 20 caracteres.
- `criado_em`: data de criação do ticket.
- `criado_por`: usuário que criou o ticket.
- `ultima_atualizacao_em`: data da última atualização do ticket.
- `fechado_em`: data de fechamento do ticket, opcional.
- `fechado_por`: usuário responsável pelo fechamento do ticket, opcional.

Índices e relacionamentos:

- `tickets_pkey`: chave primária em `id`.
- `tickets_empresa_id_fkey`: FK de `empresa_id` para `empresas.id`.
- `tickets_produto_id_fkey`: FK de `produto_id` para `produtos.id`.
- `tickets_responsavel_id_fkey`: FK de `responsavel_id` para `usuarios.id`.
- `tickets_agente_id_fkey`: FK de `agente_id` para `usuarios.id`.
- `tickets_criado_por_fkey`: FK de `criado_por` para `usuarios.id`.
- `tickets_fechado_por_fkey`: FK de `fechado_por` para `usuarios.id`.

Índices auxiliares:

- `tickets_empresa_id_idx`: índice para consultas por empresa.
- `tickets_produto_id_idx`: índice para consultas por produto.
- `tickets_responsavel_id_idx`: índice para consultas por responsável.
- `tickets_agente_id_idx`: índice para consultas por agente.
- `tickets_status_idx`: índice para consultas por status.
- `tickets_prioridade_idx`: índice para consultas por prioridade.
- `tickets_criado_em_idx`: índice para consultas por data de criação.

Regras importantes:

- Empresas vinculadas a tickets não podem ser removidas do banco.
- Usuários vinculados a tickets como responsável, agente, criador ou fechador não podem ser removidos do banco.
- Produtos vinculados a tickets não podem ser removidos do banco.
- As restrições são garantidas através de foreign keys com `ON DELETE RESTRICT`.

## Tabela `ticket_mensagens`

Criada por `010_criar_tabela_ticket_mensagens.sql`.

A tabela `ticket_mensagens` armazena as mensagens trocadas entre usuários e agentes dentro de um ticket.

Essa estrutura representa o chat/histórico de comunicação do ticket.

Campos:

- `id`: chave primária.
- `ticket_id`: ticket vinculado à mensagem.
- `conteudo`: conteúdo da mensagem enviado pelo editor rich text (`React Quill`).
- `enviado_por`: usuário responsável pelo envio da mensagem.
- `enviado_em`: data e hora do envio da mensagem.

Índices e relacionamentos:

- `ticket_mensagens_pkey`: chave primária em `id`.
- `ticket_mensagens_ticket_id_fkey`: FK de `ticket_id` para `tickets.id`.
- `ticket_mensagens_enviado_por_fkey`: FK de `enviado_por` para `usuarios.id`.

Índices auxiliares:

- `ticket_mensagens_ticket_id_idx`: índice para consultas por ticket.
- `ticket_mensagens_enviado_por_idx`: índice para consultas por usuário remetente.
- `ticket_mensagens_enviado_em_idx`: índice para consultas ordenadas por data de envio.

Regras importantes:

- Tickets que possuem mensagens vinculadas não podem ser removidos do banco.
- Usuários que possuem mensagens vinculadas não podem ser removidos do banco.
- O campo `conteudo` utiliza `TEXT` para suportar HTML vindo do editor rich text.
- A ordenação padrão das mensagens deve considerar `enviado_em`.