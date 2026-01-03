const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// 1. CONEXÃO COM O BANCO DE DADOS
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Conectado"))
  .catch(err => console.log("Erro MongoDB:", err));

// 2. MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 }
}));

// 3. ESTADO DO JOGO
let jogo = { 
    bolas: [], 
    fase: 'aguardando', 
    tempoRestante: 300, 
    premioAcumulado: 0 
};

// 4. LÓGICA DO CRONÔMETRO E SORTEIO
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

// 5. ROTA DO RANKING TOP 10 (NOVIDADE)
app.get('/top-10', async (req, res) => {
    try {
        const topUsers = await User.find({}, 'name saldo').sort({ saldo: -1 }).limit(10);
        res.set('Access-Control-Allow-Origin', '*');
        res.json(topUsers);
    } catch (e) { res.status(500).send(); }
});

// 6. ROTAS DO GERENTE
app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.set('Access-Control-Allow-Origin', '*');
        res.json(users);
    } catch (e) { res.status(500).send(); }
});

app.post('/add-saldo', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User.findById(userId);
        if (user) {
            user.saldo += amount;
            await user.save();
            res.set('Access-Control-Allow-Origin', '*');
            res.json({ message: "OK" });
        }
    } catch (e) { res.status(500).send(); }
});

// 7. ROTA DE COMPRA COM DESCONTO REAL
app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId, quantidade } = req.body;
        const user = await User.findById(usuarioId);
        const custoTotal = quantidade * 2;

        if (user && user.saldo >= custoTotal) {
            user.saldo -= custoTotal;
            await user.save();
            jogo.premioAcumulado += (quantidade * 1);
            res.set('Access-Control-Allow-Origin', '*');
            res.json({ message: "Sucesso", novoSaldo: user.saldo });
        } else { 
            res.status(400).json({ message: "Saldo insuficiente" }); 
        }
    } catch (e) { res.status(500).json({ message: "Erro" }); }
});

// 8. ROTAS DE LOGIN E STATUS
app.get('/game-status', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json(jogo);
});

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.set('Access-Control-Allow-Origin', '*');
        res.json(user);
    } catch (e) { res.status(404).send(); }
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

