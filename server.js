const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Tenta carregar as variáveis de ambiente com segurança
try {
    require('dotenv').config();
} catch (e) {
    console.log("Variáveis de ambiente carregadas via painel do Render");
}

const app = express();
app.use(cors());
app.use(express.json());

// --- RESTO DO SEU CÓDIGO DE ROTAS AQUI ---
// (Mantenha as rotas de login, registro e jogo abaixo)

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Bingo ativo na porta ${PORT}`);
});
