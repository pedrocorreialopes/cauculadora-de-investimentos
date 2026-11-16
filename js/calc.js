/* =========================================================
   Tesouro Reserva — motor de cálculo
   Função pura: não toca no DOM. Exposta em window.TesouroCalc.

   Regras aplicadas
   ---------------------------------------------------------
   1. Rendimento: 100% da Taxa Selic, convertida em taxa
      mensal equivalente -> (1 + selic)^(1/12) - 1
   2. Custódia B3: 0,20% a.a. (mensalizada na mesma base),
      cobrada apenas sobre o valor que excede a isenção
      (R$ 10.000,00 por padrão).
   3. IR: tabela regressiva de renda fixa, no resgate, sobre o
      rendimento. Cada aporte tem seu próprio prazo, então a
      alíquota é calculada aporte por aporte.
   4. IOF: apenas nos primeiros 30 dias, tabela regressiva
      oficial, sobre o rendimento.
   ========================================================= */
(function (global) {
  "use strict";

  /* Tabela regressiva do IOF (% sobre o rendimento, por dia corrido) */
  var TABELA_IOF = [
    96, 93, 90, 86, 83, 80, 76, 73, 70, 66,
    63, 60, 56, 53, 50, 46, 43, 40, 36, 33,
    30, 26, 23, 20, 16, 13, 10, 6, 3, 0
  ];

  /* Alíquotas de IR (renda fixa, tabela regressiva) por faixa de dias */
  var FAIXAS_IR = [
    { ate: 180, aliquota: 0.225, rotulo: "22,5% · até 180 dias" },
    { ate: 360, aliquota: 0.20, rotulo: "20,0% · 181 a 360 dias" },
    { ate: 720, aliquota: 0.175, rotulo: "17,5% · 361 a 720 dias" },
    { ate: Infinity, aliquota: 0.15, rotulo: "15,0% · acima de 720 dias" }
  ];

  /** Taxa anual (%) -> taxa mensal equivalente (decimal) */
  function taxaMensal(percentualAnual) {
    var a = Number(percentualAnual) || 0;
    if (a <= -100) return 0;
    return Math.pow(1 + a / 100, 1 / 12) - 1;
  }

  /** Alíquota de IR (decimal) para um prazo em dias corridos */
  function aliquotaIR(dias) {
    for (var i = 0; i < FAIXAS_IR.length; i++) {
      if (dias <= FAIXAS_IR[i].ate) return FAIXAS_IR[i].aliquota;
    }
    return FAIXAS_IR[FAIXAS_IR.length - 1].aliquota;
  }

  /** Alíquota de IOF (decimal) para um prazo em dias corridos */
  function aliquotaIOF(dias) {
    if (dias >= 30) return 0;
    var d = Math.max(1, Math.floor(dias));
    return TABELA_IOF[d - 1] / 100;
  }

  /**
   * Simula a evolução do investimento.
   *
   * @param {Object} p
   * @param {number} p.valorInicial  Valor aplicado no início do 1º mês
   * @param {number} p.aporteMensal  Valor de cada parcela (início de cada mês)
   * @param {number} p.meses         Quantidade de meses (1..600)
   * @param {number} p.selic         Taxa Selic % ao ano
   * @param {number} p.custodia      Taxa de custódia B3 % ao ano
   * @param {number} p.isencao       Saldo isento de custódia (R$)
   * @returns {Object} resultado completo da simulação
   */
  function simular(p) {
    var meses = Math.max(1, Math.min(600, Math.floor(Number(p.meses) || 0)));
    var valorInicial = Math.max(0, Number(p.valorInicial) || 0);
    var aporteMensal = Math.max(0, Number(p.aporteMensal) || 0);
    var selic = Math.max(0, Number(p.selic) || 0);
    var custodiaAA = Math.max(0, Number(p.custodia) || 0);
    var isencao = Math.max(0, Number(p.isencao) || 0);

    var rSelic = taxaMensal(selic);
    var rCustodia = taxaMensal(custodiaAA);

    /* Cada aporte vira um "lote" com principal e saldo próprios,
       necessário para aplicar o IR regressivo por prazo de cada um. */
    var lotes = [];

    var linhas = [];
    var custodiaTotal = 0;
    var rendimentoTotal = 0;
    var aporteAcumulado = 0;

    for (var m = 1; m <= meses; m++) {
      var aporteMes = (m === 1 ? valorInicial : 0) + aporteMensal;
      if (aporteMes > 0) {
        lotes.push({ principal: aporteMes, saldo: aporteMes, mes: m });
      }
      aporteAcumulado += aporteMes;

      var saldoBase = 0;
      for (var i = 0; i < lotes.length; i++) saldoBase += lotes[i].saldo;

      var rendimentoBruto = saldoBase * rSelic;
      var saldoComRendimento = saldoBase + rendimentoBruto;

      /* Custódia: incide apenas sobre o excedente da isenção */
      var baseCustodia = Math.max(0, saldoComRendimento - isencao);
      var custodiaMes = baseCustodia * rCustodia;
      var rendimentoLiquido = rendimentoBruto - custodiaMes;

      /* Distribui rendimento e custódia proporcionalmente entre os lotes
         para que a soma dos lotes permaneça idêntica ao saldo da conta. */
      if (saldoComRendimento > 0) {
        for (var j = 0; j < lotes.length; j++) {
          var loteComRend = lotes[j].saldo * (1 + rSelic);
          var parteCustodia = custodiaMes * (loteComRend / saldoComRendimento);
          lotes[j].saldo = loteComRend - parteCustodia;
        }
      }

      var saldoFinalMes = 0;
      for (var k = 0; k < lotes.length; k++) saldoFinalMes += lotes[k].saldo;

      custodiaTotal += custodiaMes;
      rendimentoTotal += rendimentoLiquido;

      var pctMes = saldoBase > 0 ? rendimentoLiquido / saldoBase : 0;

      linhas.push({
        mes: m,
        aporte: aporteMes,
        aporteAcumulado: aporteAcumulado,
        rendimentoBruto: rendimentoBruto,
        custodia: custodiaMes,
        rendimento: rendimentoLiquido,
        rendimentoPct: pctMes,
        saldo: saldoFinalMes,
        rendimentoAcumulado: saldoFinalMes - aporteAcumulado
      });
    }

    /* ---------- Resgate no fim do prazo: IOF + IR por lote ---------- */
    var irTotal = 0;
    var iofTotal = 0;
    var detalheIR = { "0.225": 0, "0.20": 0, "0.175": 0, "0.15": 0 };

    for (var n = 0; n < lotes.length; n++) {
      var lote = lotes[n];
      var dias = (meses - lote.mes + 1) * 30;
      var rendimentoLote = Math.max(0, lote.saldo - lote.principal);

      var iofLote = rendimentoLote * aliquotaIOF(dias);
      var baseIR = Math.max(0, rendimentoLote - iofLote);
      var aliq = aliquotaIR(dias);
      var irLote = baseIR * aliq;

      iofTotal += iofLote;
      irTotal += irLote;
      var chave = String(aliq);
      detalheIR[chave] = (detalheIR[chave] || 0) + irLote;
    }

    var saldoBruto = linhas.length ? linhas[linhas.length - 1].saldo : 0;
    var totalInvestido = aporteAcumulado;
    var rendimentoAcumulado = saldoBruto - totalInvestido;
    var saldoLiquido = saldoBruto - irTotal - iofTotal;

    var ultima = linhas.length ? linhas[linhas.length - 1] : null;
    var aliqMedia = rendimentoAcumulado > 0 ? irTotal / rendimentoAcumulado : 0;

    /* Alíquota efetiva no resgate exibida ao usuário */
    var faixaResgate = aliquotaIR(meses * 30);
    var rotuloFaixa = "—";
    for (var f = 0; f < FAIXAS_IR.length; f++) {
      if (meses * 30 <= FAIXAS_IR[f].ate) { rotuloFaixa = FAIXAS_IR[f].rotulo; break; }
    }

    return {
      entradas: {
        valorInicial: valorInicial,
        aporteMensal: aporteMensal,
        meses: meses,
        selic: selic,
        custodia: custodiaAA,
        isencao: isencao
      },
      taxas: {
        selicMensal: rSelic,
        selicAnual: selic,
        custodiaMensal: rCustodia,
        custodiaAnual: custodiaAA
      },
      linhas: linhas,
      ultimoMes: ultima,
      totalInvestido: totalInvestido,
      saldoBruto: saldoBruto,
      rendimentoAcumulado: rendimentoAcumulado,
      rendimentoMedioMensal: meses > 0 ? rendimentoAcumulado / meses : 0,
      custodiaTotal: custodiaTotal,
      irTotal: irTotal,
      iofTotal: iofTotal,
      saldoLiquido: saldoLiquido,
      aliquotaIRefetiva: aliqMedia,
      aliquotaResgate: faixaResgate,
      faixaResgateRotulo: rotuloFaixa,
      detalheIR: detalheIR,
      rentabilidadePeriodo: totalInvestido > 0 ? rendimentoAcumulado / totalInvestido : 0
    };
  }

  global.TesouroCalc = {
    simular: simular,
    taxaMensal: taxaMensal,
    aliquotaIR: aliquotaIR,
    aliquotaIOF: aliquotaIOF,
    TABELA_IOF: TABELA_IOF,
    FAIXAS_IR: FAIXAS_IR
  };
})(window);
