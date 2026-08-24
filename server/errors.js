export class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function asApiError(error) {
  if (error instanceof ApiError) return error;
  if (Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500) {
    return new ApiError(
      Number(error.statusCode),
      String(error.code || "REQUISICAO_INVALIDA"),
      String(error.message || "A requisição é inválida."),
    );
  }
  return new ApiError(500, "ERRO_INTERNO", "Não foi possível concluir a operação.");
}
