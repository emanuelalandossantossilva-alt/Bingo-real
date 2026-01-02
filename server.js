const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o MongoDB usando a sua variável de ambiente
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

// --- LÓGICA DO SORTEIO AUTOMÁTICO ---
let jogo = {
    bolas: [],
    fase: 'aguardando', // 'aguardando' ou 'sorteio'
    tempoRestante: 600 // 10 minutos em segundos
};

setInterval(() => {
    if (jogo.tempoRestante > 0) {
        jogo.tempoRestante--;
    } else {
        if (jogo.fase === 'aguardando') {
            jogo.fase = 'sorteio';
            iniciarSorteio();
        }
    }
}, 1000);

function iniciarSorteio() {
    let intervalo = setInterval(() => {
        if (jogo.bolas.length < 75) {
            let num;
            do { num = Math.floor(Math.random() * 75) + 1; } while (jogo.bolas.includes(num));
            jogo.bolas.push(num);
        } else {
            clearInterval(intervalo);
            setTimeout(reiniciarJogo, 30000); // Espera 30s para nova rodada
        }
    }, 4000); // Sorteia uma bola a cada 4 segundos
}

function reiniciarJogo() {
    jogo = { bolas: [], fase: 'aguardando', tempoRestante: 600 };
}

// --- ROTAS DA API ---

// Rota para ver o status do jogo (usada pelo seu HTML)
app.get('/game-status', (req, res) => {
    const minutos = Math.floor(jogo.tempoRestante / 60);
    const segundos = jogo.tempoRestante % 60;
    res.json({
        fase: jogo.fase,
        tempo: `${minutos}:${segundos.toString().padStart(2, '0')}`,
        bolas: jogo.bolas
    });
});

// Cadastro de Usuários
app.post('/register', async (req, res) => {
    try {
        const { name, email, senha } = req.body;
        const hashSenha = await bcrypt.hash(senha, 10);
        const novoUser = await User.create({ name, email, senha: hashSenha });
        res.json({ user: { name: novoUser.name, email: novoUser.email, saldo: 0 } });
    } catch (e) { res.status(400).json({ message: "E-mail já cadastrado!" }); }
});

// Login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        res.json({ user });
    } else {
        res.status(401).json({ message: "Dados incorretos!" });
    }
});

// Admin: Listar e Adicionar Saldo
app.get('/users', async (req, res) => { res.json(await User.find()); });

app.post('/add-saldo', async (req, res) => {
    const { userId, amount } = req.body;
    await User.findByIdAndUpdate(userId, { $inc: { saldo: amount } });
    res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
