import { criarAplicacaoApi } from "./app.js";
import { carregarConfiguracaoServidor } from "./config.js";
import {
  criarAutenticadorDesenvolvimento,
  criarAutenticadorOidc,
} from "./auth/oidc.js";
import { criarRepositorioMemoria } from "./db/memoryRepository.js";
import { criarRepositorioPostgres } from "./db/postgresRepository.js";

const configuracao = carregarConfiguracaoServidor();
const repository = configuracao.armazenamento === "postgres"
  ? criarRepositorioPostgres({
      connectionString: configuracao.databaseUrl,
      ssl: configuracao.databaseSsl,
    })
  : criarRepositorioMemoria();
const authenticate = configuracao.permitirIdentidadeDesenvolvimento
  ? criarAutenticadorDesenvolvimento()
  : criarAutenticadorOidc({
      issuer: configuracao.oidcIssuer,
      audience: configuracao.oidcAudience,
      jwksUrl: configuracao.oidcJwksUrl,
    });

const app = await criarAplicacaoApi({
  repository,
  authenticate,
  corsOrigins: configuracao.corsOrigins,
  logger: { level: configuracao.logLevel },
});

try {
  await app.listen({ host: configuracao.host, port: configuracao.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
