/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: src/utils/mapPPCI.js

   RESPONSABILIDADE:
   Adaptar os dados da planilha para o modelo interno
   utilizado pela aplicação.
========================================================= */

export default function mapPPCI(item = {}) {

    return {

        /* =====================================================
           IDENTIFICAÇÃO
        ===================================================== */

        id: item.ID,

        unidade: item.Unidade,

        predio: item["Prédio / Edificação"],

        categoria: item.Categoria,

        status: item["Status / Situação"],

        prioridade: item.Prioridade,

        conclusao: item["% Conclusão"],

        /* =====================================================
           PESSOAS
        ===================================================== */

        responsavel: item.Responsável,

        solicitante: item.Solicitante,

        /* =====================================================
           PROCESSO
        ===================================================== */

        processo: item["Número do PPCI / Processo CBMRS"],

        descricao: item["Descrição / Itens"],

        providencia: item["Providência / Próximo passo"],

        /* =====================================================
           DATAS
        ===================================================== */

        entrada: item["Data de entrada"],

        inicio: item["Data de início Obra/Projeto"],

        entrega: item["Data prevista entrega Obra/Projeto"],

        vencimento: item["Data limite / vencimento PPCI"],

        /* =====================================================
           DOCUMENTOS
        ===================================================== */

        documentos: {

            processo: item["Link Processo CBMRS"],

            sharepoint: item["Link SharePoint"],

            projeto: item["Link Projeto"],

            art: item["Link ART"],

            alvara: item["Link Alvará"]

        },

        /* =====================================================
           OBJETO ORIGINAL
        ===================================================== */

        original: item

    };

}