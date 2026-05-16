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
* Tela de minha conta para manutenção dos dados do usuário autenticado.
* Configurações gerais da aplicação e parâmetros de e-mail.
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

Permite consultar empresas cadastradas e, para usuários administradores, criar, editar e excluir empresas. Ao criar uma empresa, o sistema vincula automaticamente o usuário criador à nova empresa.

### Usuários

Área para consultar usuários, cadastrar novos registros, editar dados cadastrais, controlar status, definir perfil, marcar administradores e gerenciar vínculos com empresas.

### Perfis

Área administrativa para cadastro e manutenção de perfis de acesso. Cada perfil define permissões por recurso e ação, como visualizar, criar, atualizar e deletar.

### Configurações

Área administrativa para manutenção dos dados gerais da aplicação, disponibilidade do sistema e parâmetros usados em envios de e-mail.

### Minha conta

Tela para o usuário autenticado consultar e atualizar seus próprios dados.

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
