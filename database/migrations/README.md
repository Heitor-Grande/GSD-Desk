# Migrations

Execute os scripts em ordem crescente pelo prefixo numérico. Esta pasta contém as migrations PostgreSQL do projeto.

## Ordem de execução

1. `001_criar_tabela_usuarios.sql`
2. `002_criar_tabela_configuracao.sql`
3. `004_criar_tabela_perfil.sql`
4. `005_criar_tabela_empresas.sql`
5. `006_criar_tabela_usuarios_empresas.sql`

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
