const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexão com MongoDB com tratamento de erro (Evita o Failed Deploy)
const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error("❌ Erro: Variável MONGODB_URI não configurada no Render.");
            return;
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Conectado!");
    } catch (err) {
        console.error("❌ Erro ao conectar ao MongoDB:", err.message);
        // Não encerra o processo para o Render não dar 'Failed'
    }
};
connectDB();

// Rota de Status para o Cron-job (Manter acordado)
app.get('/status', (req, res) => {
    res.status(200).json({ 
        online: true, 
        database: mongoose.connection.readyState === 1 ? "conectado" : "desconectado" 
    });
});

// --- AS SUAS ROTAS (Login, Registro, Comprar, etc) DEVERÃO FICAR AQUI ---
// Certifique-se de copiar as rotas do seu código antigo e colar aqui.

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
