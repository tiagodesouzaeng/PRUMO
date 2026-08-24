import { criarAplicacaoApi } from "./app.js";
import { carregarConfiguracaoServidor } from "./config.js";
import {
  criarAutenticadorDesenvolvimento,
  criarAutenticadorComposto,
  criarAutenticadorOidc,
} from "./auth/oidc.js";
import { criarAutenticacaoLocal } from "./auth/localAdmin.js";
import { criarRepositorioMemoria } from "./db/memoryRepository.js";
import { criarRepositorioPostgres } from "./db/postgresRepository.js";
import { criarArmazenamentoObjetos } from "./storage/objectStorage.js";

const configuracao = carregarConfiguracaoServidor();
const localAuth = criarAutenticacaoLocal({
  habilitada: configuracao.localAdminEnabled,
  usuario: configuracao.localAdminUser,
  subject: configuracao.localAdminSubject,
  passwordHash: configuracao.localAdminPasswordHash,
  passwordSalt: configuracao.localAdminPasswordSalt,
  sessionSecret: configuracao.localAdminSessionSecret,
  expiresMinutes: configuracao.localAdminSessionMinutes,
});
const repository = configuracao.armazenamento === "postgres"
  ? criarRepositorioPostgres({
      connectionString: configuracao.databaseUrl,
      ssl: configuracao.databaseSsl,
    })
  : criarRepositorioMemoria({
      memberships: [{
        tenantId: "EMP-PRUMO-DEMO",
        subject: localAuth.habilitada ? localAuth.subject : "dev-user",
        perfilId: "administrador",
        teamIds: ["EQ-ORCAMENTOS", "EQ-OBRAS"],
        status: "ativo",
      }],
    });
const oidcAuth = criarAutenticadorOidc({
      issuer: configuracao.oidcIssuer,
      audience: configuracao.oidcAudience,
      jwksUrl: configuracao.oidcJwksUrl,
    });
const authenticate = localAuth.habilitada
  ? criarAutenticadorComposto({ oidc: oidcAuth, local: localAuth })
  : configuracao.permitirIdentidadeDesenvolvimento
    ? criarAutenticadorDesenvolvimento()
    : oidcAuth;
const objectStorage = criarArmazenamentoObjetos(configuracao);

const app = await criarAplicacaoApi({
  repository,
  authenticate,
  localAuth,
  objectStorage,
  storageRequired: configuracao.nodeEnv === "production",
  identityRequired: configuracao.nodeEnv === "production",
  identityMode: configuracao.localAdminEnabled && configuracao.oidcIssuer
    ? "oidc+contingencia"
    : configuracao.localAdminEnabled ? "contingencia" : configuracao.permitirIdentidadeDesenvolvimento
    ? "desenvolvimento"
    : configuracao.oidcIssuer ? "oidc" : "nao_configurado",
  corsOrigins: configuracao.corsOrigins,
  logger: { level: configuracao.logLevel },
});

try {
  await app.listen({ host: configuracao.host, port: configuracao.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
