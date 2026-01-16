# Migração de SolidJS para React - Páginas do OpenCode

## Resumo das Páginas Migradas

### 1. LoginPage (`login.tsx`)
- **Status**: Completa
- **Conversões realizadas**:
  - `createSignal` → `useState`
  - `Show` → conditional rendering com `&&`
  - `For` → `.map()`
  - `onMount` → `useEffect`
- **Funcionalidades mantidas**:
  - Toggle entre login/register
  - Validação de senhas
  - Lista de usuários públicos
  - Exibição de erro
  - Design visual com classes Tailwind

### 2. HomePage (`home.tsx`)
- **Status**: Completa
- **Conversões realizadas**:
  - `createMemo` → `useMemo`
  - `Switch/Match` → operadores ternários
  - Navegação com React Router
- **Funcionalidades mantidas**:
  - Header mobile com menu hamburger
  - Lista de projetos recentes
  - Botão para abrir projeto
  - Status do servidor
  - Tratamento de sessão vazia

### 3. LayoutPage (`layout.tsx`)
- **Status**: Completa (versão simplificada)
- **Conversões realizadas**:
  - `createStore` → `useState`
  - `createEffect` → `useEffect`
  - `onCleanup` → cleanup no `useEffect`
  - Componentes aninhados como funções
- **Funcionalidades mantidas**:
  - Sidebar com projetos
  - Sessões por projeto
  - Mobile sidebar
  - Navegação entre sessões
  - Dropdown menu para projetos
  - Botões de ação (novo projeto, conectar provedor, etc.)

### 4. AdminPage (`admin.tsx`)
- **Status**: Completa
- **Conversões realizadas**:
  - `createSignal` → `useState`
  - `createMemo` → `useMemo`
  - `Show` → conditional rendering
- **Funcionalidades mantidas**:
  - Abas: Usuários, Níveis de Acesso, RAG, Integrações
  - CRUD de usuários
  - CRUD de níveis de acesso
  - Gestão de permissões
  - Base de conhecimento RAG (simplificado)
  - Verificação de permissões de acesso

### 5. SessionPage (`session.tsx`)
- **Status**: Completa (versão funcional)
- **Conversões realizadas**:
  - Complexidade alta convertida para React hooks
  - `createResizeObserver` → `ResizeObserver`
  - `onCleanup` → cleanup no `useEffect`
  - Event listeners → `useEffect`
- **Funcionalidades mantidas**:
  - Header da sessão
  - Lista de mensagens
  - Review de diffs
  - Tabs de contexto/arquivos
  - Prompt input
  - Terminal (simplificado)
  - Navegação entre mensagens
  - Comandos de teclado

## Ajustes Necessários

### Contextos e Hooks necessários:
1. **`useLayout`**: Precisa implementar métodos como `projects.open()`, `projects.close()`, `sidebar.toggle()`, etc.
2. **`useGlobalSync`**: Precisa implementar `data.message`, `data.session`, `child()`, etc.
3. **`useAuth`**: Precisa implementar `login()`, `register()`, `users()`, `isMaster()`, etc.
4. **`useSDK`**: Precisa implementar cliente de sessão
5. **`useTerminal`**: Precisa implementar gerenciamento de terminais
6. **`useFile`**: Precisa implementar gerenciamento de arquivos
7. **`usePrompt`**: Precisa implementar gerenciamento de prompts
8. **`usePermission`**: Precisa implementar gerenciamento de permissões

### Componentes de UI necessários:
1. `Button` - já existente
2. `Icon` - já existente
3. `IconButton` - já existente
4. `Avatar` - já existente
5. `Tooltip/TooltipKeybind` - já existente
6. `Collapsible` - já existente
7. `Tabs` - já existente
8. `ResizeHandle` - já existente
9. `DropdownMenu` - já existente
10. `Spinner` - já existente
11. `Dialog` - já existente

### Componentes de aplicação necessários:
1. `DialogSelectDirectory`
2. `DialogSelectServer`
3. `DialogSelectProvider`
4. `DialogEditProject`
5. `DialogSelectFile`
6. `DialogSelectModel`
7. `DialogSelectMcp`
8. `DialogFork`
9. `PromptInput`
10. `SessionContextUsage`
11. `SessionHeader`
12. `SessionTurn`
13. `SessionMessageRail`
14. `SessionReview`

### Utilitários necessários:
1. `base64Encode`/`base64Decode`
2. `getFilename`
3. `DateTime` do luxon

## Notas de Desenvolvimento

1. **Estado Local**: Onde o SolidJS usava signals reativos, o React usa `useState` com atualizações de estado tradicionais.

2. **Efeitos**: `createEffect` foi convertido para `useEffect`, com atenção especial aos cleanup functions.

3. **Refs**: Alguns refs do SolidJS foram convertidos para `useRef` do React.

4. **Routing**: O SolidJS Router foi substituído pelo React Router.

5. **Stores**: O `createStore` do SolidJS foi substituído por `useState` com objetos.

6. **Media Queries**: `createMediaQuery` foi substituído por `window.matchMedia`.

7. **Event Listeners**: Adicionados com `useEffect` e limpos no return.

## Próximos Passos

1. Implementar os contextos faltantes (`useLayout`, `useGlobalSync`, etc.)
2. Criar os componentes de UI e aplicação necessários
3. Integrar com as APIs do ChatIAS
4. Testar cada página individualmente
5. Corrigir bugs e ajustar funcionalidades
