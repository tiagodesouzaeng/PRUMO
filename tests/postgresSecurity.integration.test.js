import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";
import { criarWorkerTrabalhos } from "../server/workers/jobWorker.js";

const { Client } = pg;
const apiUrl = process.env.PRUMO_DATABASE_URL || "";
const migrationUrl = process.env.PRUMO_MIGRATION_DATABASE_URL || "";
const executarIntegracao = Boolean(apiUrl && migrationUrl);

async function aguardarTrabalho(repository, contexto, trabalhoId, statusEsperado) {
  const limite = Date.now() + 5000;
  while (Date.now() < limite) {
    const trabalhos = await repository.listarTrabalhos(contexto);
    const trabalho = trabalhos.find((item) => item.id === trabalhoId);
    if (trabalho?.status === statusEsperado) return trabalho;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`O trabalho ${trabalhoId} não alcançou o estado ${statusEsperado}.`);
}

test("PostgreSQL real impede invasão entre empresas e equipes", {
  skip: !executarIntegracao && "Conexões PostgreSQL de integração não configuradas.",
}, async () => {
  const sufixo = randomUUID().slice(0, 8);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const teamA1 = randomUUID();
  const teamA2 = randomUUID();
  const teamB = randomUUID();
  const subjectA = `teste-rls-a-${sufixo}`;
  const subjectB = `teste-rls-b-${sufixo}`;
  const admin = new Client({ connectionString: migrationUrl });
  const api = new Client({ connectionString: apiUrl });
  const repository = criarRepositorioPostgres({ connectionString: apiUrl });
  let orcamentoId = "";

  try {
    await admin.connect();
    await api.connect();
    await admin.query(
      `INSERT INTO app.tenants (id, nome) VALUES
        ($1, 'Teste RLS A'), ($2, 'Teste RLS B')`,
      [tenantA, tenantB],
    );
    await admin.query(
      `INSERT INTO app.teams (tenant_id, id, nome) VALUES
        ($1, $2, 'Equipe A1'),
        ($1, $3, 'Equipe A2'),
        ($4, $5, 'Equipe B')`,
      [tenantA, teamA1, teamA2, tenantB, teamB],
    );
    await admin.query(
      `INSERT INTO app.memberships
        (tenant_id, identity_subject, perfil_id)
       VALUES ($1, $2, 'administrador'), ($3, $4, 'administrador')`,
      [tenantA, subjectA, tenantB, subjectB],
    );
    await admin.query(
      `INSERT INTO app.team_memberships
        (tenant_id, team_id, identity_subject)
       VALUES ($1, $2, $3), ($1, $4, $3), ($5, $6, $7)`,
      [tenantA, teamA1, subjectA, teamA2, tenantB, teamB, subjectB],
    );

    const contextoA1 = {
      identity: { subject: subjectA },
      tenantId: tenantA,
      teamId: teamA1,
    };
    const contextoA2 = {
      identity: { subject: subjectA },
      tenantId: tenantA,
      teamId: teamA2,
    };
    const contextoB = {
      identity: { subject: subjectB },
      tenantId: tenantB,
      teamId: teamB,
    };
    const criado = await repository.criarOrcamento(
      contextoA1,
      { nome: "Orçamento isolado", dados: { origem: "teste-rls" } },
      `orcamento-rls-${sufixo}`,
    );
    orcamentoId = criado.id;

    await assert.rejects(
      () => repository.obterOrcamento(contextoB, orcamentoId),
      (error) => error.code === "ORCAMENTO_NAO_ENCONTRADO",
    );
    assert.equal((await repository.listarOrcamentos(contextoA2)).length, 0);

    await api.query("BEGIN");
    await api.query(
      "SELECT app.ativar_contexto($1, $2, $3)",
      [tenantA, subjectA, teamA1],
    );
    await assert.rejects(
      () => api.query(
        `INSERT INTO app.orcamentos
          (tenant_id, id, team_id, nome, dados, criado_por)
         VALUES ($1, $2, $3, 'Invasão bloqueada', '{}', $4)`,
        [tenantB, randomUUID(), teamB, subjectA],
      ),
      (error) => error.code === "42501",
    );
    await api.query("ROLLBACK");
  } finally {
    await repository.fechar();
    await api.end().catch(() => {});
    if (admin._connected) {
      await admin.query("BEGIN");
      await admin.query(
        "SELECT app.ativar_contexto($1, $2, $3)",
        [tenantA, subjectA, teamA1],
      );
      if (orcamentoId) {
        await admin.query("DELETE FROM app.orcamentos WHERE id = $1", [orcamentoId]);
      }
      await admin.query("DELETE FROM app.domain_events");
      await admin.query(
        "DELETE FROM app.idempotency_keys WHERE chave = $1",
        [`orcamento:orcamento-rls-${sufixo}`],
      );
      await admin.query("COMMIT");
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)", [tenantA]);
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)", [tenantB]);
      await admin.query(
        "DELETE FROM app.team_memberships WHERE tenant_id IN ($1, $2)",
        [tenantA, tenantB],
      );
      await admin.query(
        "DELETE FROM app.memberships WHERE tenant_id IN ($1, $2)",
        [tenantA, tenantB],
      );
      await admin.query(
        "DELETE FROM app.teams WHERE tenant_id IN ($1, $2)",
        [tenantA, tenantB],
      );
      await admin.query("DELETE FROM app.tenants WHERE id IN ($1, $2)", [tenantA, tenantB]);
      await admin.end();
    }
  }
});

test("worker real retoma pendência e registra falha reprocessável", {
  skip: !executarIntegracao && "Conexões PostgreSQL de integração não configuradas.",
}, async () => {
  const sufixo = randomUUID().slice(0, 8);
  const tenantId = randomUUID();
  const teamId = randomUUID();
  const subject = `teste-worker-${sufixo}`;
  const admin = new Client({ connectionString: migrationUrl });
  const repository = criarRepositorioPostgres({ connectionString: apiUrl });
  const worker = criarWorkerTrabalhos({ repository, logger: { error() {} } });
  const contexto = {
    identity: { subject },
    tenantId,
    teamId,
  };

  try {
    await admin.connect();
    await admin.query(
      "INSERT INTO app.tenants (id, nome) VALUES ($1, 'Teste worker')",
      [tenantId],
    );
    await admin.query(
      "INSERT INTO app.teams (tenant_id, id, nome) VALUES ($1, $2, 'Equipe worker')",
      [tenantId, teamId],
    );
    await admin.query(
      `INSERT INTO app.memberships
        (tenant_id, identity_subject, perfil_id)
       VALUES ($1, $2, 'administrador')`,
      [tenantId, subject],
    );
    await admin.query(
      `INSERT INTO app.team_memberships
        (tenant_id, team_id, identity_subject)
       VALUES ($1, $2, $3)`,
      [tenantId, teamId, subject],
    );

    const pendente = await repository.criarTrabalho(
      contexto,
      { tipo: "sistema.diagnostico", payload: { origem: "retomada" } },
      `retomada-${sufixo}`,
    );
    assert.equal(pendente.status, "pendente");
    worker.agendar(contexto, pendente.id);
    const concluido = await aguardarTrabalho(
      repository,
      contexto,
      pendente.id,
      "concluido",
    );
    assert.equal(concluido.tentativas, 1);
    assert.equal(concluido.resultado.ok, true);

    const invalido = await repository.criarTrabalho(
      contexto,
      {
        tipo: "orcamento.recalcular",
        payload: { orcamentoId: randomUUID() },
        maxTentativas: 2,
      },
      `falha-${sufixo}`,
    );
    worker.agendar(contexto, invalido.id);
    const falhou = await aguardarTrabalho(repository, contexto, invalido.id, "falhou");
    assert.equal(falhou.tentativas, 1);
    assert.equal(falhou.erro.codigo, "ORCAMENTO_NAO_ENCONTRADO");

    const reprocessado = await repository.reprocessarTrabalho(contexto, invalido.id);
    assert.equal(reprocessado.status, "pendente");
    worker.agendar(contexto, invalido.id);
    const falhouNovamente = await aguardarTrabalho(
      repository,
      contexto,
      invalido.id,
      "falhou",
    );
    assert.equal(falhouNovamente.tentativas, 2);
    await assert.rejects(
      () => repository.reprocessarTrabalho(contexto, invalido.id),
      (error) => error.code === "TRABALHO_NAO_REPROCESSAVEL",
    );
  } finally {
    await worker.fechar();
    await repository.fechar();
    if (admin._connected) {
      await admin.query("BEGIN");
      await admin.query(
        "SELECT app.ativar_contexto($1, $2, $3)",
        [tenantId, subject, teamId],
      );
      await admin.query("DELETE FROM app.jobs");
      await admin.query(
        "DELETE FROM app.idempotency_keys WHERE chave LIKE 'trabalho:%'",
      );
      await admin.query("COMMIT");
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)", [tenantId]);
      await admin.query("DELETE FROM app.team_memberships WHERE tenant_id = $1", [tenantId]);
      await admin.query("DELETE FROM app.memberships WHERE tenant_id = $1", [tenantId]);
      await admin.query("DELETE FROM app.teams WHERE tenant_id = $1", [tenantId]);
      await admin.query("DELETE FROM app.tenants WHERE id = $1", [tenantId]);
      await admin.end();
    }
  }
});
