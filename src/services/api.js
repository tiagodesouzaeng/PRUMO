/* =========================================================
   RELEASE........: v1.0.1
   ARQUIVO........: src/services/api.js

   RESPONSABILIDADE:
   Comunicação com a API Google Apps Script.
========================================================= */

import axios from "axios";

const API_URL =
  "https://script.google.com/macros/s/AKfycbz0bKVJ6Fc8UL7hFv9gAzdDlKyLHIE9Vskwuwydd3uJ9DSdoFt82OZ69ZB_sOwRZn2PlA/exec";

export async function getPPCIs() {

  try {

    const response = await axios.get(API_URL);

    if (!Array.isArray(response.data)) {
      console.warn("A API retornou um formato inesperado.");
      return [];
    }

    return response.data;

  } catch (error) {

    console.error("Erro ao consultar a API PPCI:", error);

    throw error;

  }

}