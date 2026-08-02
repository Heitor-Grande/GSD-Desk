# GSD Desk

O **GSD Desk** é uma aplicação web para gerenciamento de tickets, solicitações e rotinas de suporte. A plataforma centraliza o acesso de usuários, empresas, perfis e configurações operacionais para apoiar equipes que precisam organizar atendimentos, controlar permissões e administrar vínculos entre usuários e empresas.

---

## Funcionalidades principais

* Autenticação por e-mail e senha.
* Sessão protegida por cookie e validação JWT.
* Recuperação de senha com envio de código por e-mail.
* Área interna protegida com menu lateral responsivo.
* Seleção da empresa de navegação para usuários vinculados a mais de uma empresa.
* Controle de permissões por perfil.
* Controle administrativo por usuário com campo `isAdmin`.
* Gestão de usuários, empresas, perfis e vínculos.
* Gestão de produtos vinculados ao cadastro de empresas.
* Tela de minha conta para manutenção dos dados do usuário autenticado.
* Configurações gerais da aplicação e parâmetros de e-mail.
* API de integração para criação automática de tickets a partir de erros em softwares de clientes.
* Respostas de API padronizadas com `sucesso`, `msg` e `dados`.

---

## Acesso e segurança

A tela inicial apresenta o GSD Desk e disponibiliza o formulário de login. Após autenticação, o usuário acessa a área interna de acordo com sua sessão, status, perfil e permissões.

O fluxo de recuperação de senha permite solicitar um código por e-mail e redefinir a senha quando necessário. Rotas sensíveis contam com rate limit para reduzir tentativas repetidas.

Algumas áreas possuem regras adicionais:

* Configurações e perfis exigem usuário administrador.
* Criação, edição e exclusão de usuários e empresas exigem usuário administrador.
* Vínculos entre usuários e empresas exigem usuário administrador.
* Listagens e acessos internos respeitam permissões do perfil do usuário.

---

## Menus da aplicação

### Dashboard

Tela inicial da área interna. Serve como ponto de entrada para acompanhamento geral da operação e acesso às principais áreas do sistema.

### Empresas

Permite consultar empresas cadastradas e, para usuários administradores, criar, editar e excluir empresas. Ao criar uma empresa, o sistema vincula automaticamente o usuário criador à nova empresa. No formulário de empresa, também é possível gerenciar usuários vinculados e produtos da empresa.

### Usuários

Área para consultar usuários, cadastrar novos registros, editar dados cadastrais, controlar status, definir perfil, marcar administradores e gerenciar vínculos com empresas.

### Perfis

Área administrativa para cadastro e manutenção de perfis de acesso. Cada perfil define permissões por recurso e ação, como visualizar, criar, atualizar e deletar.

### Configurações

Área administrativa para manutenção dos dados gerais da aplicação, disponibilidade do sistema e parâmetros usados em envios de e-mail.

### Minha conta

Tela para o usuário autenticado consultar e atualizar seus próprios dados.

---

## API de integração

O GSD Desk possui uma API de integração para permitir que softwares de clientes abram tickets automaticamente quando ocorrerem erros no ambiente do cliente. O objetivo é registrar a falha diretamente na fila de atendimento, sem depender de abertura manual pelo usuário.

### Geração do token

O token de acesso da integração é gerado no cadastro da empresa, na aba **API**. A geração exige usuário autenticado com permissão de atualização de empresa. O token é único para a empresa, deve ser mantido em sigilo e enviado nas requisições como Bearer Token.

Endpoint interno usado pela tela administrativa:

```text
GET /api/empresas/tokenapi?id_empresa={idEmpresa}
```

### Criação automática de ticket

Endpoint público da integração:

```text
POST /api/integracao/autoticket
```

Header obrigatório:

```text
Authorization: Bearer {token_api}
Content-Type: application/json
```

Body esperado:

```json
{
  "informacoes_gerais": {
    "titulo": "Erro ao processar pedido",
    "empresa_id": 1,
    "produto_id": 10
  },
  "detalhes": {
    "conteudo": "Descrição técnica do erro, stack trace, tela, usuário afetado ou demais dados úteis para o suporte."
  }
}
```

Regras principais:

* O token precisa ser válido.
* O usuário que gerou o token precisa continuar ativo.
* O produto informado precisa pertencer à empresa e estar ativo.
* A empresa precisa possuir um usuário ativo com perfil `Cliente Manager`, usado como responsável inicial do ticket.
* O ticket é criado com status inicial padrão, prioridade alta e título sufixado com `- Api`.
* Após a criação, agentes de suporte vinculados à empresa são notificados por e-mail quando houver endereços cadastrados.

Resposta de sucesso:

```json
{
  "sucesso": true,
  "msg": "Ticket criado com sucesso.",
  "dados": {
    "ticketId": 123
  }
}
```

---

## Stack utilizada

* Next.js com App Router
* TypeScript
* Tailwind CSS
* React Bootstrap para modais
* React Select para selects
* React Icons para ícones
* PostgreSQL via `pg`
* Nodemailer para envio de e-mails
* ESLint

---

## Estrutura principal

```text
src/
├── app/
│   ├── (app)/          # telas internas protegidas
│   ├── api/            # rotas de API da aplicação
│   ├── page.tsx        # tela pública de login
│   └── cssGlobal.css   # estilos globais
├── components/         # componentes reutilizáveis de UI
├── services/           # integrações, banco de dados e e-mail
├── utils/              # autenticação, permissões, validações e helpers
└── proxy.ts            # proteção de rotas
```

---

## Como rodar o projeto

Instale as dependências:

```bash
npm install
```

Rode o ambiente de desenvolvimento:

```bash
npm run dev
```

A aplicação estará disponível em:

```text
http://localhost:3000
```

Comandos úteis:

```bash
npm run lint
npm run build
```
