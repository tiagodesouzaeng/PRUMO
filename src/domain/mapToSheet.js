/* =========================================================
   RELEASE........: v1.1.0 RC2
========================================================= */

export default function mapToSheet(ppci){

    return{

        ID: ppci.id,

        Unidade: ppci.unidade,

        "Prédio / Edificação": ppci.predio,

        Categoria: ppci.categoria,

        "Status / Situação": ppci.status,

        Prioridade: ppci.prioridade,

        Responsável: ppci.responsavel,

        Solicitante: ppci.solicitante,

        "Número do PPCI / Processo CBMRS": ppci.processo,

        "Descrição / Itens": ppci.descricao,

        "Providência / Próximo passo": ppci.providencia,

        "Data de entrada": ppci.entrada,

        "Data de início Obra/Projeto": ppci.inicio,

        "Data prevista entrega Obra/Projeto": ppci.entrega,

        "Data limite / vencimento PPCI": ppci.vencimento,

        "% Conclusão": ppci.conclusao

    };

}