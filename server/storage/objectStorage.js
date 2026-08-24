import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function nomeSeguro(nome = "arquivo") {
  const normalizado = String(nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return normalizado || "arquivo";
}

function chaveSegura(chave, tenantId) {
  const valor = String(chave || "");
  if (!valor.startsWith(`${tenantId}/documentos/`) || valor.includes("..")) {
    throw new Error("A referência do arquivo não pertence à organização ativa.");
  }
  return valor;
}

export function criarArmazenamentoDesabilitado() {
  return {
    tipo: "desabilitado",
    configurado: false,
    async health() {
      return { ok: false, tipo: "desabilitado", mensagem: "Storage GED não configurado." };
    },
    async criarUpload() {
      throw new Error("O armazenamento corporativo de arquivos não foi configurado.");
    },
    async criarDownload() {
      throw new Error("O armazenamento corporativo de arquivos não foi configurado.");
    },
    async fechar() {},
  };
}

export function criarArmazenamentoS3({
  region,
  bucket,
  endpoint = "",
  forcePathStyle = false,
  accessKeyId = "",
  secretAccessKey = "",
  sessionToken = "",
  expiresIn = 300,
  client: clientInjetado,
  assinar = getSignedUrl,
} = {}) {
  if (!region || !bucket) throw new Error("O storage S3 exige região e bucket.");
  const credentials = accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) }
    : undefined;
  const client = clientInjetado || new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: Boolean(forcePathStyle),
    ...(credentials ? { credentials } : {}),
  });

  return {
    tipo: "s3",
    configurado: true,
    async health() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return { ok: true, tipo: "s3", mensagem: "Storage GED disponível." };
      } catch {
        return { ok: false, tipo: "s3", mensagem: "Storage GED indisponível." };
      }
    },
    async criarUpload({ tenantId, documentoId, nomeArquivo, tipoMime }) {
      const storageKey = `${tenantId}/documentos/${documentoId}/${randomUUID()}-${nomeSeguro(nomeArquivo)}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        ContentType: tipoMime || "application/octet-stream",
        Metadata: { tenant: tenantId, documento: documentoId },
      });
      return {
        metodo: "PUT",
        url: await assinar(client, command, { expiresIn }),
        storageKey,
        expiraEm: new Date(Date.now() + expiresIn * 1000).toISOString(),
        headers: { "Content-Type": tipoMime || "application/octet-stream" },
      };
    },
    async criarDownload({ tenantId, storageKey, nomeArquivo }) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: chaveSegura(storageKey, tenantId),
        ResponseContentDisposition: `attachment; filename="${nomeSeguro(nomeArquivo)}"`,
      });
      return {
        url: await assinar(client, command, { expiresIn }),
        expiraEm: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    },
    async fechar() {
      client.destroy?.();
    },
  };
}

export function criarArmazenamentoObjetos(configuracao = {}) {
  if (configuracao.storageProvider === "s3") {
    return criarArmazenamentoS3({
      region: configuracao.storageRegion,
      bucket: configuracao.storageBucket,
      endpoint: configuracao.storageEndpoint,
      forcePathStyle: configuracao.storageForcePathStyle,
      accessKeyId: configuracao.storageAccessKeyId,
      secretAccessKey: configuracao.storageSecretAccessKey,
      sessionToken: configuracao.storageSessionToken,
      expiresIn: configuracao.storageSignedUrlTtl,
    });
  }
  return criarArmazenamentoDesabilitado();
}
