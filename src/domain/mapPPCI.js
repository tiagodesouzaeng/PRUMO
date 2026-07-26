import { PPCI_SCHEMA } from "./schemaPPCI";

export default function mapPPCI(item = {}) {

    return {

        ...PPCI_SCHEMA,

        id: item.ID,

        unidade: item.Unidade,

        predio: item["Prédio / Edificação"],

        categoria: item.Categoria,

        status: item["Status / Situação"],

        prioridade: item.Prioridade,

        responsavel: item.Responsável,

        solicitante: item.Solicitante,

        processo: item["Número do PPCI / Processo CBMRS"],

        descricao: item["Descrição / Itens"],

        providencia: item["Providência / Próximo passo"],

        entrada: item["Data de entrada"],

        inicio: item["Data de início Obra/Projeto"],

        entrega: item["Data prevista entrega Obra/Projeto"],

        vencimento: item["Data limite / vencimento PPCI"],

        conclusao: item["% Conclusão"],

        documentos: {

            processo: item["Link Processo CBMRS"],

            sharepoint: item["Link SharePoint"],

            projeto: item["Link Projeto"],

            art: item["Link ART"],

            alvara: item["Link Alvará"]

        },

        original: item

    };

}