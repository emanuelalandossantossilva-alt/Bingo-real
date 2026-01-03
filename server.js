const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Conectado"))
  .catch(err => console.log("Erro MongoDB:", err));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };

// CRONÔMETRO (Já está funcionando!)
setInterval(() => {
    if (jogo.tempoRestante > 0) {
        jogo.tempoRestante--;
    } else if (jogo.fase === 'aguardando') {
        jogo.fase = 'sorteio';
        iniciarSorteio();
    }
}, 1000);

function iniciarSorteio() {
    let intervalo = setInterval(() => {
        if (jogo.bolas.length < 75) {
            let num;
            do { num = Math.floor(Math.random() * 75) + 1; } 
            while (jogo.bolas.includes(num));
            jogo.bolas.push(num);
        } else {
            clearInterval(intervalo);
            setTimeout(reiniciarJogo, 30000);
        }
    }, 4000); 
}

function reiniciarJogo() {
    jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };
}

// --- ROTAS DO GERENTE (PARA CORRIGIR O ERRO DE CONEXÃO) ---
app.get('/users', async (req, res) => {
    const users = await User.find();
    res.set('Access-Control-Allow-Origin', '*');
    res.json(users);
});

app.post('/add-saldo', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User.findById(userId);
        user.saldo += amount;
        await user.save();
        res.set('Access-Control-Allow-Origin', '*');
        res.json({ message: "OK" });
    } catch (e) { res.status(500).send(); }
});

// --- ROTA DE COMPRA (PARA CORRIGIR "ERRO NA COMPRA") ---
app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId, quantidade } = req.body;
        const user = await User.findById(usuarioId);
        if (user.saldo >= (quantidade * 2)) {
            user.saldo -= (quantidade * 2);
            await user.save();
            jogo.premioAcumulado += (quantidade * 1);
            res.set('Access-Control-Allow-Origin', '*');
            res.json({ message: "Sucesso" });
        } else { res.status(400).json({ message: "Saldo insuficiente" }); }
    } catch (e) { res.status(500).json({ message: "Erro" }); }
});

// ROTAS DE LOGIN E STATUS
app.get('/game-status', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json(jogo);
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(user) res.json({ user });
    else res.status(401).json({ message: "Erro" });
});

app.post('/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ message: "Criado" });
    } catch (e) { res.status(400).json({ message: "Erro" }); }
});

app.listen(process.env.PORT || 3000);

