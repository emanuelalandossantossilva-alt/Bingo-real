const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o Banco de Dados
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Conectado"))
  .catch(err => console.log("Erro MongoDB:", err));

// Modelo de Usuário
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

// Lógica do Jogo
let jogo = {
    bolas: [],
    fase: 'aguardando',
    tempoRestante: 300,
    premioAcumulado: 0
};

// Rota para o botão "USAR MEU SALDO" funcionar
app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId, quantidade } = req.body;
        const valorTotal = quantidade * 2.0; 
        const user = await User.findById(usuarioId);
        if (user.saldo >= valorTotal) {
            user.saldo -= valorTotal; 
            await user.save();
            jogo.premioAcumulado += (quantidade * 1.0);
            res.json({ message: "Cartelas compradas com sucesso!" });
        } else {
            res.status(400).json({ message: "Saldo insuficiente!" });
        }
    } catch (error) {
        res.status(500).json({ message: "Erro ao processar compra" });
    }
});

// Rotas Básicas (Login/Status)
app.get('/game-status', (req, res) => res.json(jogo));
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email, senha });
    if(user) res.json({ user });
    else res.status(401).json({ message: "Erro no login" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor Online"));

