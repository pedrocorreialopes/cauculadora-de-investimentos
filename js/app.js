/* =========================================================
   Tesouro Reserva — camada de interface
   Depende de js/calc.js (window.TesouroCalc)
   ========================================================= */
(function () {
  "use strict";

  /* ----------------------------- DOM ----------------------------- */
  var form = document.getElementById("sim-form");
  var elValorInicial = document.getElementById("valor-inicial");
  var elAporte = document.getElementById("aporte-mensal");
  var elMeses = document.getElementById("meses");
  var elSelic = document.getElementById("selic");
  var elCustodia = document.getElementById("custodia");
  var elIsencao = document.getElementById("isencao");
  var elErro = document.getElementById("form-erro");
  var elStatus = document.getElementById("status");
  var elBtnLimpar = document.getElementById("btn-limpar");
  var elBtnCsv = document.getElementById("btn-csv");

  var ui = {
    periodo: document.getElementById("resumo-periodo"),
    kpiRendimento: document.getElementById("kpi-rendimento"),
    kpiRendimentoMeta: document.getElementById("kpi-rendimento-meta"),
    kpiSaldo: document.getElementById("kpi-saldo"),
    kpiSaldoMeta: document.getElementById("kpi-saldo-meta"),
    kpiInvestido: document.getElementById("kpi-investido"),
    kpiInvestidoMeta: document.getElementById("kpi-investido-meta"),
    kpiJuros: document.getElementById("kpi-juros"),
    kpiJurosMeta: document.getElementById("kpi-juros-meta"),
    statMedia: document.getElementById("stat-media"),
    statCustodia: document.getElementById("stat-custodia"),
    statIr: document.getElementById("stat-ir"),
    statIrAliquota: document.getElementById("stat-ir-aliquota"),
    statLiquido: document.getElementById("stat-liquido"),
    statLiquidoNota: document.getElementById("stat-liquido-nota"),
    tabelaCorpo: document.getElementById("tabela-corpo"),
    tabelaSub: document.getElementById("tabela-sub"),
    chartFallback: document.getElementById("chart-fallback")
  };

  var chart = null;
  var ultimoResultado = null;

  /* ------------------------- Formatadores ------------------------ */
  var brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  var num2 = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  var num4 = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });

  function moeda(v) { return brl.format(Number(v) || 0); }
  function pct(v, casas) {
    var n = (Number(v) || 0) * 100;
    return (casas === 4 ? num4.format(n) : num2.format(n)) + "%";
  }

  /* ------------------------ Máscara de R$ ------------------------ */
  /** "1.234,56" -> 1234.56 ; tolera digitação livre */
  function parseMoeda(texto) {
    if (texto === null || texto === undefined) return 0;
    var limpo = String(texto).replace(/[^\d,.-]/g, "");
    if (!limpo) return 0;

    // Se houver vírgula, tratamos como separador decimal pt-BR
    if (limpo.indexOf(",") > -1) {
      limpo = limpo.replace(/\./g, "").replace(",", ".");
    } else {
      // Sem vírgula: pontos podem ser milhar ("1.234") ou decimal ("1234.5")
      var partes = limpo.split(".");
      if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) {
        limpo = limpo.replace(/\./g, "");
      }
    }
    var n = parseFloat(limpo);
    return isFinite(n) ? n : 0;
  }

  /** 1234.5 -> "1.234,50" (sem símbolo) */
  function formataMoedaInput(valor) {
    var n = Number(valor) || 0;
    return num2.format(n);
  }

  /* Converte um campo mascarado enquanto digita: só dígitos, centavos fixos */
  function aplicarMascaraCentavos(input) {
    input.addEventListener("input", function () {
      var digitos = input.value.replace(/\D/g, "");
      if (!digitos) {
        input.value = "";
        input.classList.remove("input--erro");
        return;
      }
      var n = parseInt(digitos, 10) / 100;
      input.value = num2.format(n);
      input.classList.remove("input--erro");
    });

    input.addEventListener("blur", function () {
      var n = parseMoeda(input.value);
      input.value = formataMoedaInput(n);
    });
  }

  [elValorInicial, elAporte, elIsencao].forEach(aplicarMascaraCentavos);

  /* --------------------------- Helpers -------------------------- */
  function setErro(msg) {
    if (msg) {
      elErro.textContent = msg;
      elErro.hidden = false;
    } else {
      elErro.textContent = "";
      elErro.hidden = true;
    }
  }

  function marcarInvalido(el, invalido) {
    if (!el) return;
    if (invalido) el.classList.add("input--erro");
    else el.classList.remove("input--erro");
    el.setAttribute("aria-invalid", invalido ? "true" : "false");
  }

  function pluralMeses(n) {
    return n === 1 ? "1 mês" : n + " meses";
  }

  function anosEmeses(meses) {
    var a = Math.floor(meses / 12);
    var m = meses % 12;
    var partes = [];
    if (a > 0) partes.push(a === 1 ? "1 ano" : a + " anos");
    if (m > 0) partes.push(m === 1 ? "1 mês" : m + " meses");
    return partes.join(" e ");
  }

  /* ---------------------- Leitura de entradas ------------------- */
  function leEntradas() {
    var valorInicial = parseMoeda(elValorInicial.value);
    var aporte = parseMoeda(elAporte.value);
    var meses = Math.floor(Number(elMeses.value) || 0);
    var selic = Number(String(elSelic.value).replace(",", ".")) || 0;
    var custodia = Number(String(elCustodia.value).replace(",", ".")) || 0;
    var isencao = parseMoeda(elIsencao.value);

    var erros = [];

    marcarInvalido(elValorInicial, valorInicial < 0);
    marcarInvalido(elAporte, aporte < 0);
    marcarInvalido(elMeses, meses < 1 || meses > 600);
    marcarInvalido(elSelic, selic < 0 || selic > 100);
    marcarInvalido(elCustodia, custodia < 0 || custodia > 5);

    if (meses < 1 || meses > 600) {
      erros.push("Informe a quantidade de meses entre 1 e 600.");
    }
    if (valorInicial < 1 && aporte < 1) {
      erros.push("Informe um valor inicial ou um aporte mensal de pelo menos R$ 1,00.");
    }
    if (selic < 0 || selic > 100) {
      erros.push("A Taxa Selic deve estar entre 0% e 100% ao ano.");
    }
    if (custodia < 0 || custodia > 5) {
      erros.push("A taxa de custódia deve estar entre 0% e 5% ao ano.");
    }

    if (erros.length) {
      setErro(erros[0]);
      return null;
    }

    setErro(null);
    return {
      valorInicial: valorInicial,
      aporteMensal: aporte,
      meses: meses,
      selic: selic,
      custodia: custodia,
      isencao: isencao
    };
  }

  /* --------------------------- KPIs ----------------------------- */
  function renderResumo(r) {
    var u = r.ultimoMes || { rendimento: 0, rendimentoPct: 0, saldo: 0 };

    ui.periodo.textContent =
      pluralMeses(r.entradas.meses) + " · " + anosEmeses(r.entradas.meses) +
      " · Selic " + num2.format(r.entradas.selic) + "% a.a.";

    ui.kpiRendimento.textContent = moeda(u.rendimento);
    ui.kpiRendimentoMeta.textContent =
      pct(u.rendimentoPct, 4) + " sobre o montante de " + moeda(u.saldo - u.rendimento) +
      " no mês " + u.mes;

    ui.kpiSaldo.textContent = moeda(r.saldoBruto);
    ui.kpiSaldoMeta.textContent = "em " + anosEmeses(r.entradas.meses) + ", antes do IR";

    ui.kpiInvestido.textContent = moeda(r.totalInvestido);
    ui.kpiInvestidoMeta.textContent = r.entradas.valorInicial > 0
      ? moeda(r.entradas.valorInicial) + " + " + r.entradas.meses + " × " + moeda(r.entradas.aporteMensal)
      : r.entradas.meses + " × " + moeda(r.entradas.aporteMensal);

    ui.kpiJuros.textContent = moeda(r.rendimentoAcumulado);
    ui.kpiJurosMeta.textContent = "+" + pct(r.rentabilidadePeriodo) + " sobre o total investido";

    ui.statMedia.textContent = moeda(r.rendimentoMedioMensal);

    ui.statCustodia.textContent = moeda(r.custodiaTotal);

    ui.statIr.textContent = moeda(r.irTotal);
    ui.statIrAliquota.textContent = r.rendimentoAcumulado > 0
      ? "efetiva " + pct(r.aliquotaIRefetiva) + " · faixa final " + pct(r.aliquotaResgate)
      : "sem rendimento tributável";

    ui.statLiquido.textContent = moeda(r.saldoLiquido);
    ui.statLiquidoNota.textContent = r.iofTotal > 0
      ? "após " + moeda(r.irTotal) + " de IR e " + moeda(r.iofTotal) + " de IOF"
      : "após " + moeda(r.irTotal) + " de IR · IOF " + moeda(0);
  }

  /* -------------------------- Tabela ---------------------------- */
  function renderTabela(r) {
    var partes = [];
    var linhas = r.linhas;

    ui.tabelaSub.textContent =
      "Rendimento de cada mês sobre o montante da conta · " +
      pct(r.taxas.selicMensal, 4) + " ao mês";

    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i];
      partes.push(
        "<tr>" +
          '<td scope="row">' + l.mes + "</td>" +
          "<td>" + moeda(l.aporte) + "</td>" +
          '<td class="cell-rend">' + moeda(l.rendimento) + "</td>" +
          '<td class="cell-pct">' + pct(l.rendimentoPct, 4) + "</td>" +
          '<td class="cell-custodia">' + (l.custodia > 0.004 ? "−" + moeda(l.custodia) : "isento") + "</td>" +
          '<td class="cell-saldo">' + moeda(l.saldo) + "</td>" +
          '<td class="cell-rend">' + moeda(l.rendimentoAcumulado) + "</td>" +
        "</tr>"
      );
    }

    ui.tabelaCorpo.innerHTML = partes.join("");
  }

  /* -------------------------- Gráfico --------------------------- */
  function renderGrafico(r) {
    var canvas = document.getElementById("grafico");
    if (!canvas) return;

    if (typeof window.Chart === "undefined") {
      ui.chartFallback.hidden = false;
      return;
    }
    ui.chartFallback.hidden = true;

    var labels = r.linhas.map(function (l) { return "Mês " + l.mes; });
    var saldo = r.linhas.map(function (l) { return l.saldo; });
    var investido = r.linhas.map(function (l) { return l.aporteAcumulado; });

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = saldo;
      chart.data.datasets[1].data = investido;
      chart.update();
      return;
    }

    var ctx = canvas.getContext("2d");
    var gradSaldo = ctx.createLinearGradient(0, 0, 0, 340);
    gradSaldo.addColorStop(0, "rgba(61, 220, 196, 0.38)");
    gradSaldo.addColorStop(1, "rgba(61, 220, 196, 0.02)");

    chart = new window.Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Saldo bruto",
            data: saldo,
            borderColor: "#3ddcc4",
            backgroundColor: gradSaldo,
            borderWidth: 2.4,
            fill: true,
            tension: 0.32,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#3ddcc4",
            pointHoverBorderColor: "#06231f",
            pointHoverBorderWidth: 2
          },
          {
            label: "Total investido",
            data: investido,
            borderColor: "rgba(139, 123, 255, 0.9)",
            backgroundColor: "transparent",
            borderWidth: 1.8,
            borderDash: [6, 5],
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: "#8b7bff"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 6, right: 4, left: 0, bottom: 0 } },
        animation: { duration: 520 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(9, 14, 26, 0.95)",
            borderColor: "rgba(140, 165, 215, 0.28)",
            borderWidth: 1,
            titleColor: "#eef2fb",
            titleFont: { family: "Inter", size: 12, weight: "600" },
            bodyColor: "#aebad4",
            bodyFont: { family: "Inter", size: 12 },
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            callbacks: {
              label: function (item) {
                return " " + item.dataset.label + ": " + moeda(item.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: "#7d8aa6",
              font: { family: "Inter", size: 10.5 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              callback: function (value) {
                var m = this.getLabelForValue(value);
                return m ? m.replace("Mês ", "M") : "";
              }
            }
          },
          y: {
            grid: { color: "rgba(140, 165, 215, 0.09)" },
            border: { display: false },
            ticks: {
              color: "#7d8aa6",
              font: { family: "Inter", size: 10.5 },
              maxTicksLimit: 6,
              callback: function (v) {
                if (Math.abs(v) >= 1000000) return "R$ " + num2.format(v / 1000000) + " mi";
                if (Math.abs(v) >= 1000) return "R$ " + num2.format(v / 1000) + " mil";
                return "R$ " + num2.format(v);
              }
            }
          }
        }
      }
    });
  }

  /* ---------------------------- CSV ----------------------------- */
  function exportarCsv() {
    if (!ultimoResultado) {
      elStatus.textContent = "Calcule uma simulação antes de exportar.";
      return;
    }
    var r = ultimoResultado;
    var sep = ";";

    function linha(vals) { return vals.join(sep); }
    function n(v) { return (Number(v) || 0).toFixed(2).replace(".", ","); }

    var out = [];
    out.push(linha(["Mes", "Aporte", "Rendimento do mes (R$)", "Rendimento % sobre o saldo",
      "Custodia B3 (R$)", "Saldo bruto (R$)", "Rendimento acumulado (R$)"]));

    r.linhas.forEach(function (l) {
      out.push(linha([
        l.mes,
        n(l.aporte),
        n(l.rendimento),
        n(l.rendimentoPct * 100),
        n(l.custodia),
        n(l.saldo),
        n(l.rendimentoAcumulado)
      ]));
    });

    out.push("");
    out.push(linha(["Resumo"]));
    out.push(linha(["Total investido", n(r.totalInvestido)]));
    out.push(linha(["Saldo bruto final", n(r.saldoBruto)]));
    out.push(linha(["Rendimento acumulado", n(r.rendimentoAcumulado)]));
    out.push(linha(["Custodia B3 paga", n(r.custodiaTotal)]));
    out.push(linha(["IR estimado no resgate", n(r.irTotal)]));
    out.push(linha(["IOF", n(r.iofTotal)]));
    out.push(linha(["Saldo liquido no resgate", n(r.saldoLiquido)]));
    out.push(linha(["Selic (% a.a.)", n(r.entradas.selic)]));

    var blob = new Blob(["\uFEFF" + out.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "tesouro-reserva-" + r.entradas.meses + "-meses.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);

    elStatus.textContent = "CSV exportado com " + r.linhas.length + " meses.";
  }

  /* -------------------------- Execução -------------------------- */
  function calcular() {
    var entradas = leEntradas();
    if (!entradas) {
      elStatus.textContent = "";
      return;
    }

    var r = window.TesouroCalc.simular(entradas);
    ultimoResultado = r;

    renderResumo(r);
    renderTabela(r);
    renderGrafico(r);

    elStatus.textContent =
      "Simulação calculada com " + pluralMeses(r.entradas.meses) +
      " · " + r.linhas.length + " linhas na tabela.";
  }

  /* --------------------------- Eventos -------------------------- */
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    calcular();
  });

  /* Recalcula com um pequeno debounce quando os campos mudam */
  var debounceId = null;
  ["input", "change"].forEach(function (evt) {
    form.addEventListener(evt, function (ev) {
      if (ev.target.closest(".chips")) return;
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(function () {
        if (ultimoResultado) calcular();
      }, 420);
    });
  });

  /* Chips de prazo */
  var chips = document.querySelectorAll(".chip[data-meses]");
  Array.prototype.forEach.call(chips, function (chip) {
    chip.addEventListener("click", function () {
      elMeses.value = chip.getAttribute("data-meses");
      Array.prototype.forEach.call(chips, function (c) { c.classList.remove("is-ativo"); });
      chip.classList.add("is-ativo");
      calcular();
    });
  });

  /* Marca o chip correspondente ao valor inicial do campo */
  function sincronizarChips() {
    var atual = Math.floor(Number(elMeses.value) || 0);
    Array.prototype.forEach.call(chips, function (c) {
      c.classList.toggle("is-ativo", Number(c.getAttribute("data-meses")) === atual);
    });
  }
  elMeses.addEventListener("input", sincronizarChips);

  /* Limpar */
  elBtnLimpar.addEventListener("click", function () {
    elValorInicial.value = "1.000,00";
    elAporte.value = "300,00";
    elMeses.value = "24";
    elSelic.value = "14.5";
    elCustodia.value = "0.20";
    elIsencao.value = "10.000,00";
    setErro(null);
    [elValorInicial, elAporte, elMeses, elSelic, elCustodia, elIsencao].forEach(function (el) {
      marcarInvalido(el, false);
    });
    sincronizarChips();
    elStatus.textContent = "Campos redefinidos para o exemplo padrão.";
    calcular();
  });

  elBtnCsv.addEventListener("click", exportarCsv);

  /* -------------------------- Primeira carga -------------------- */
  function iniciar() {
    sincronizarChips();
    calcular();
    if (typeof window.Chart === "undefined") {
      ui.chartFallback.hidden = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  /* Se o Chart.js chegar depois (defer + CDN), redesenha */
  window.addEventListener("load", function () {
    if (chart === null && ultimoResultado) renderGrafico(ultimoResultado);
  });
})();
