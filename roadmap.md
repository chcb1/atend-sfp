# Correções de login e menu
- [ ] Centralizar eventos de sessão, renovar atividade no login e limpar no logout.
- [ ] Separar menu da conta do menu operacional, preservando navegação móvel.
- [ ] Testar sessão, auditoria e cabeçalho nas quatro larguras solicitadas.

# Quatro ajustes (pedido único)
- [x] Fixar @tanstack/react-router 1.170.16 e @tanstack/router-plugin 1.168.18 (sem ^) no package.json e bun.lock.
- [x] Sessão: expirar ao reabrir/voltar à aba se última atividade > 10 min; gravar timestamp no login.
- [x] Dashboard: saídas por natureza, Consolidado no topo, remover linha Bruta/Despesas/Impostos/Lucro, nova ordem das seções.
- [x] Cabeçalho: logo sem quebra de linha; nomes do menu só em lg (ícones com title/aria-label entre md e lg).
- [x] Verificar: typecheck, build, header em 768/1024/1280px, expiração de sessão, soma de impostos no dashboard.
