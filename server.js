const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Conexão com o Banco de Dados usando sua variável de ambiente
mongoose.connect(process.env.MONGODB_URI);

// Rota principal para acabar com o erro 404 do Cron-Job
app.get('/', (req, res) => res.send("Servidor de Bingo Ativo!"));

// Rota de sorteio que o Cron-Job deve chamar
app.get('/game-status', (req, res) => {
    // Lógica de sorteio das bolas aqui
    res.json({ status: "Sorteio realizado", bolas: [1, 5, 10] }); 
});

// Rotas de Usuário (Login/Cadastro)
app.post('/register', async (req, res) => { /* lógica de cadastro */ });
app.post('/login', async (req, res) => { /* lógica de login */ });

app.listen(process.env.PORT || 3000);

