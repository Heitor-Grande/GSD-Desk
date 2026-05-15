# Migrations

Execute os scripts em ordem crescente pelo prefixo numérico. Esta pasta contém as migrations do banco PostgreSQL do GSD Desk.

## Ordem de execução

1. `001_criar_tabela_usuarios.sql`
2. `002_criar_tabela_configuracao.sql`
3. `004_criar_tabela_perfil.sql`
4. `005_criar_tabela_empresas.sql`
5. `006_criar_tabela_usuarios_empresas.sql`

## `001_criar_tabela_usuarios.sql`

Cria a tabela `usuarios`, usada para autenticação e cadastro de usuários do sistema.

Campos obrigatórios principais:

- `nome`
- `email`
- `senha_hash`
- `salt`
- `ativo`
- `criado_em`
- `atualizado_em`

Observações:

- `email` possui índice único normalizado em minúsculas.
- `perfil_id` passa a referenciar `perfil.id` após a migration de perfis.

## `002_criar_tabela_configuracao.sql`

Cria a tabela `configuracao`, usada para armazenar configurações gerais da aplicação.

Campos obrigatórios principais:

- `disponibilidade`
- `criado_em`
- `atualizado_em`

## `004_criar_tabela_perfil.sql`

Cria a tabela `perfil`, usada para armazenar perfis de permissão.

Campos obrigatórios principais:

- `nome`
- `ativo`
- `permissoes`
- `criado_em`
- `atualizado_em`

Relacionamentos:

- Adiciona a chave estrangeira `usuarios.perfil_id` para `perfil.id`.

## `005_criar_tabela_empresas.sql`

Cria a tabela `empresas`, usada para cadastrar as empresas atendidas ou operadas no sistema.

Campos obrigatórios:

- `fantasia`
- `cnpj`
- `ativo`
- `criado_por`
- `criado_em`
- `atualizado_em`

Relacionamentos:

- `criado_por` referencia `usuarios.id`.
- `atualizado_por` referencia `usuarios.id`.

Observações:

- `cnpj` possui índice único para evitar duplicidade.
- `email`, `telefone` e `atualizado_por` são opcionais.

## `006_criar_tabela_usuarios_empresas.sql`

Cria a tabela `usuarios_empresas`, usada para vincular usuários existentes às empresas cadastradas.

Campos obrigatórios:

- `usuario_id`
- `empresa_id`
- `criado_por`
- `criado_em`

Relacionamentos:

- `usuario_id` referencia `usuarios.id`.
- `empresa_id` referencia `empresas.id`.
- `criado_por` referencia `usuarios.id`.

Observações:

- O vínculo entre `usuario_id` e `empresa_id` é único, evitando duplicidade para o mesmo usuário na mesma empresa.
- Há índices para `usuario_id` e `empresa_id`, facilitando consultas por usuário ou empresa.
