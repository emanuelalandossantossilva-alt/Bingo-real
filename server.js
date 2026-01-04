
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO DO MONGODB COM RECONEXÃO AUTOMÁTICA
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Conectado com Sucesso!");
    } catch (err) {
        console.error("❌ Erro ao conectar ao MongoDB:", err.message);
        setTimeout(connectDB, 5000); // Tenta reconectar em 5 segundos
    }
};
connectDB();

// ROTA DE SAÚDE (Para o Cron-job usar)
app.get('/status', (req, res) => {
    res.status(200).json({ status: "Online", database: mongoose.connection.readyState === 1 ? "Conectado" : "Desconectado" });
});

// Suas rotas de Jogo, Login e Cadastro continuam abaixo...
// (Mantenha o restante do seu código de lógica de bingo aqui)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
