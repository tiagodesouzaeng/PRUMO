import { resumirRecalculoOrcamento } from "../domain/jobs.js";

export function criarWorkerTrabalhos({ repository, logger = console } = {}) {
  if (!repository) throw new Error("O worker exige um repositório.");
  const agendados = new Map();
  const emExecucao = new Set();
  let encerrado = false;

  async function executar(contexto, trabalhoId) {
    const trabalho = await repository.iniciarTrabalho(contexto, trabalhoId, "prumo-worker-local");
    if (!trabalho || trabalho.status !== "processando") return trabalho;
    try {
      let resultado;
      if (trabalho.tipo === "sistema.diagnostico") {
        resultado = {
          ok: true,
          armazenamento: repository.tipo,
          processadoEm: new Date().toISOString(),
        };
      } else if (trabalho.tipo === "catalogo.importar") {
        resultado = await repository.salvarItensCatalogo(
          contexto,
          trabalho.payload.publicacaoId,
          trabalho.payload.itens,
          `trabalho:${trabalho.id}`,
        );
      } else if (trabalho.tipo === "orcamento.recalcular") {
        const orcamento = await repository.obterOrcamento(
          contexto,
          trabalho.payload.orcamentoId,
        );
        resultado = resumirRecalculoOrcamento(orcamento);
      } else {
        throw new Error(`Trabalho ${trabalho.tipo} sem executor.`);
      }
      return repository.concluirTrabalho(contexto, trabalho.id, resultado);
    } catch (error) {
      logger?.error?.({ err: error, trabalhoId }, "Falha no trabalho assíncrono");
      return repository.falharTrabalho(contexto, trabalho.id, {
        codigo: error.code || "TRABALHO_FALHOU",
        mensagem: error.message,
      });
    }
  }

  function agendar(contexto, trabalhoId) {
    if (encerrado || agendados.has(trabalhoId)) return;
    const temporizador = setTimeout(async () => {
      agendados.delete(trabalhoId);
      const promessa = executar(contexto, trabalhoId)
        .catch((error) => {
          logger?.error?.({ err: error, trabalhoId }, "Falha ao iniciar o trabalho assíncrono");
        })
        .finally(() => emExecucao.delete(promessa));
      emExecucao.add(promessa);
      await promessa;
    }, 0);
    agendados.set(trabalhoId, temporizador);
  }

  return {
    agendar,
    executar,
    async fechar() {
      encerrado = true;
      agendados.forEach((temporizador) => clearTimeout(temporizador));
      agendados.clear();
      await Promise.allSettled([...emExecucao]);
      emExecucao.clear();
    },
  };
}
