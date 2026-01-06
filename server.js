const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// LIBERAÇÃO TOTAL DE CONEXÃO (Resolve o erro da sua foto)
app.use(cors());
app.use(express.json());

// CONEXÃO COM O BANCO DE DADOS
// Importante: No Render, adicione a variável MONGO_URI nas configurações
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("Banco de Dados Conectado!"))
    .catch(err => console.log("Erro no Banco:", err));

// MODELO DO JOGADOR
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 }
}));

// ROTA DE CADASTRO
app.post('/register', async (req, res) => {
    try {
        const { name, email, senha } = req.body;
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: "E-mail já existe!" });
        
        const newUser = new User({ name, email, senha });
        await newUser.save();
        res.status(201).json({ message: "Cadastrado!" });
    } catch (err) {
        res.status(500).json({ message: "Erro ao salvar no banco" });
    }
});

// ROTA DE LOGIN
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email, senha });
    if (user) res.json(user);
    else res.status(401).json({ message: "E-mail ou senha errados" });
});

// ROTA DE STATUS QUE VOCÊ TESTOU
app.get('/game-status', (req, res) => {
    res.json({ status: "Servidor Online", bolas: [1, 5, 10] });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Bingo rodando!"));

