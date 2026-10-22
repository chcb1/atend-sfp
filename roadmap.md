# Ajustes visuais dos gráficos e agenda
- [ ] Rosca de saídas com cores compartilhadas, até seis fatias e bases percentuais explícitas.
- [ ] Por procedimento com porcentagens na legenda, tooltip e rótulos a partir de 5%.
- [ ] Ações da agenda sem quebra; verificar Dia, Semana e Mês em desktop e celular.

# Correções de login e menu
- [x] Centralizar eventos de sessão, renovar atividade no login e limpar no logout.
- [x] Separar menu da conta do menu operacional, preservando navegação móvel.
- [x] Testar sessão real gerenciada, auditoria, saída manual e reabertura com 11 minutos simulados; cabeçalho admin nas quatro larguras.
- [ ] Verificar entrada digitando senha e cabeçalho com conta comum: testes disponíveis usam sessão gerenciada da conta admin, sem senha ou sessão autorizada de conta comum.

# Quatro ajustes (pedido único)
- [x] Fixar @tanstack/react-router 1.170.16 e @tanstack/router-plugin 1.168.18 (sem ^) no package.json e bun.lock.
- [x] Sessão: expirar ao reabrir/voltar à aba se última atividade > 10 min; gravar timestamp no login.
- [x] Dashboard: saídas por natureza, Consolidado no topo, remover linha Bruta/Despesas/Impostos/Lucro, nova ordem das seções.
- [x] Cabeçalho: logo sem quebra de linha; nomes do menu só em lg (ícones com title/aria-label entre md e lg).
- [x] Verificar: typecheck, build, header em 768/1024/1280px, expiração de sessão, soma de impostos no dashboard.
