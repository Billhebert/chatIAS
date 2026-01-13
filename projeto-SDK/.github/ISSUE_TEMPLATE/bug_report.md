---
name: Bug Report
about: Criar um relatório de bug
title: '[BUG] '
labels: bug
assignees: ''
---

## Descrição do Bug
Uma descrição clara e concisa do bug.

## Para Reproduzir
Passos para reproduzir o comportamento:
1. Execute '...'
2. Veja erro '...'

## Comportamento Esperado
Descrição clara do que você esperava que acontecesse.

## Screenshots ou Logs
Se aplicável, adicione screenshots ou logs completos.

```bash
# Execute com logs completos
node chat.js 2>&1 | tee error.log
```

## Ambiente
- OS: [e.g. Windows 11, Ubuntu 22.04, macOS 14]
- Node.js: [e.g. v20.10.0]
- NPM: [e.g. 10.2.3]
- OpenCode instalado? [Sim/Não]
- Ollama instalado? [Sim/Não]

## Informações Adicionais
```bash
# Cole a saída dos comandos abaixo
node --version
npm --version
npm list --depth=0

# Se OpenCode instalado
opencode --version

# Se Ollama instalado
ollama list
```

## Checklist
- [ ] Tentei executar `node chat-standalone.js`
- [ ] Li o [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)
- [ ] Verifiquei issues existentes
- [ ] Incluí logs completos
