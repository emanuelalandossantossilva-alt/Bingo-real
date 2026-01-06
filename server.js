const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// LIBERAÇÃO DE ACESSO: Garante que o site no GitHub Pages consiga se conectar
app.use(cors());
app.use(express.json());

// LINK DO BANCO DE DADOS (Já configurado com sua senha)
const mongoURI = "mongodb+srv://emanntossilva_db_user:jdTfhDfvYbeSHnQH@cluster0.mxdnuqr.mongodb.net/bingo_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("BANCO DE DADOS CONECTADO!"))
    .catch(err => console.log("ERRO AO CONECTAR NO MONGODB:", err));

// MODELO DE USUÁRIO (O que será salvo no banco)
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ROTA DE CADASTRO: Resolve o erro da imagem 1000074131.jpg
app.post('/register', async (req, res) => {
    try {
        const { name, email, senha } = req.body;
        
        // Verifica se o email já existe para evitar erro de duplicidade
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: "Este e-mail já está em uso!" });
        
        const newUser = new User({ name, email, senha });
        await newUser.save();
        res.status(201).json({ message: "Cadastro realizado com sucesso!" });
    } catch (err) {
        // Se chegar aqui, o banco recusou a gravação
        res.status(500).json({ message: "Erro técnico ao salvar no banco de dados." });
    }
});

// ROTA DE LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email, senha });
        if (user) {
            res.json(user);
        } else {
            res.status(401).json({ message: "E-mail ou senha incorretos." });
        }
    } catch (err) {
        res.status(500).json({ message: "Erro no servidor." });
    }
});

// ROTA DE STATUS DO JOGO
app.get('/game-status', (req, res) => {
    res.json({ 
        status: "Servidor Online e Banco Conectado",
        timestamp: new Date()
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
