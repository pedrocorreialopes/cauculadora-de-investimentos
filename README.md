# Tesouro Reserva — Simulador de evolução do investimento

Aplicação estática (HTML + CSS + JavaScript, sem build) que projeta a evolução de um
investimento no **Tesouro Reserva** (título que rende 100% da Taxa Selic), mostrando
mês a mês o rendimento sobre o montante da conta, a custódia da B3 e o imposto no resgate.

## Entrada

- **Valor inicial** (aplicado no início do 1º mês), com máscara de moeda pt-BR.
- **Valor de cada parcela** (aporte mensal, no início de cada mês; `0` = aporte único).
- **Quantidade de meses** (1 a 600), com atalhos de 1, 2, 5 e 10 anos.
- **Parâmetros avançados** (abertos opcionalmente): Selic % a.a. (padrão 14,50),
  custódia B3 % a.a. (padrão 0,20) e limite de isenção de custódia (padrão R$ 10.000,00).

## Saída

- **Rendimento do último mês** em reais e em % sobre o montante da conta (destaque principal).
- **Saldo final bruto**, **total investido** e **rendimento acumulado**.
- Rendimento médio mensal, custódia B3 paga, **IR no resgate** (com alíquota efetiva),
  **saldo líquido** após IR e IOF.
- **Gráfico de linha** (Chart.js) comparando saldo bruto × total investido.
- **Tabela mês a mês**: aporte, rendimento do mês, % sobre o saldo, custódia, saldo bruto
  e rendimento acumulado — com exportação para **CSV**.

## Regras de cálculo (`js/calc.js`)

| Item | Regra implementada |
| --- | --- |
| Rendimento | 100% da Selic, mensalizada: `(1 + selic)^(1/12) − 1` (14,50% a.a. ≈ 1,1348% a.m.) |
| Liquidez | Diária, sem marcação a mercado → projeção composta mensal, principal nunca reduz |
| Custódia B3 | 0,20% a.a. mensalizado, incidente **apenas sobre o que excede a isenção** de R$ 10.000,00 |
| IR | Tabela regressiva (22,5% até 180 d, 20% até 360 d, 17,5% até 720 d, 15% acima), **aporte por aporte** segundo o prazo de cada um |
| IOF | Tabela regressiva oficial (96% no 1º dia → 0% no 30º), apenas nos primeiros 30 dias; zero em resgates a partir de 30 dias |

Cada aporte é tratado como um "lote" com principal e saldo próprios; rendimento e custódia
são distribuídos proporcionalmente entre os lotes, de modo que a soma dos lotes seja sempre
idêntica ao saldo da conta (validado: diferença < 1e-9). O resgate é simulado ao fim do prazo.

Premissas: Selic constante, aportes no início do mês, custódia e isenção fixas, IR estimado
no resgate final, sem feriados. Simulação educacional — não é recomendação de investimento.

## Estrutura e caminhos

```
index.html        página única (hero, formulário, KPIs, gráfico, tabela, metodologia)
css/style.css     tema escuro, mobile-first, breakpoints 640 / 960 / 1180 px + impressão
js/calc.js        motor de cálculo puro (window.TesouroCalc), sem DOM
js/app.js         máscaras, validação, renderização, Chart.js e export CSV
```

- Entrada única: `/index.html` (CSS em `css/style.css`).
- Dependência externa: Chart.js 4.4.1 via jsDelivr e fontes Inter/Sora via Google Fonts.
  Se o Chart.js não carregar, a tabela e os KPIs continuam funcionando e aparece um aviso
  no lugar do gráfico (`#chart-fallback`).

## Armazenamento

Nenhum. Aplicação 100% client-side e stateless: não usa localStorage, IndexedDB, tabelas
ou banco de dados. Recarregar a página volta ao exemplo padrão (R$ 1.000,00 + R$ 300,00 × 24 meses).

## Status

- [x] Formulário com máscara de moeda, validação e recálculo automático (debounce 420 ms)
- [x] KPIs, resumo de custos/impostos e destaque do rendimento mensal
- [x] Gráfico de evolução, tabela mensal e exportação CSV
- [x] Layout responsivo verificado em desktop (1280 px) e mobile (390 px), console limpo
- [ ] Deploy público (Hosted Deploy) — não executado; nenhuma URL pública ativa ainda

## Próximos passos sugeridos

1. Autorizar um Hosted Deploy para publicar o simulador publicamente.
2. Opcional: integrar uma API pública da Selic (ex.: SGS/BCB) para preencher a taxa automaticamente.
3. Opcional: permitir simular resgates parciais ou comparar com CDI/poupança.
