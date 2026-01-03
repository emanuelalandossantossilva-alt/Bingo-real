const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// CONEXÃO
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Conectado"))
  .catch(err => console.log("Erro MongoDB:", err));

// MODELO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 }
}));

// ESTADO DO JOGO (Agora com limite de 50 bolas)
let jogo = { 
    bolas: [], 
    fase: 'aguardando', 
    tempoRestante: 300, 
    premioAcumulado: 0 
};

// CRONÔMETRO
setInterval(() => {
    if (jogo.tempoRestante > 0) {
        jogo.tempoRestante--;
    } else if (jogo.fase === 'aguardando') {
        jogo.fase = 'sorteio';
        iniciarSorteio();
    }
}, 1000);

// SORTEIO LIMITADO A 50 BOLAS
function iniciarSorteio() {
    let intervalo = setInterval(() => {
        if (jogo.bolas.length < 50) { // Alterado para 50 bolas
            let num;
            do { num = Math.floor(Math.random() * 50) + 1; } 
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

// FUNÇÃO PARA GERAR CARTELA DE 10 NÚMEROS ALEATÓRIOS (Sem sequências simples)
function gerarCartelaUnica() {
    let numeros = [];
    while (numeros.length < 10) { // Agora com 10 números
        let num = Math.floor(Math.random() * 50) + 1;
        if (!numeros.includes(num)) {
            numeros.push(num);
        }
    }
    // Ordena para facilitar a visualização, mas os números são aleatórios
    return numeros.sort((a, b) => a - b);
}

// ROTA DE COMPRA (Cartela R$ 2 | Acumulado R$ 1,50)
app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId, quantidade } = req.body;
        const user = await User.findById(usuarioId);
        const custoTotal = quantidade * 2;
        const valorParaPremio = quantidade * 1.5;

        if (user && user.saldo >= custoTotal) {
            user.saldo -= custoTotal;
            await user.save();
            
            jogo.premioAcumulado += valorParaPremio;
            
            // Gera as cartelas de 10 números para o jogador
            let novasCartelas = [];
            for(let i=0; i<quantidade; i++) {
                novasCartelas.push(gerarCartelaUnica());
            }

            res.set('Access-Control-Allow-Origin', '*');
            res.json({ 
                message: "Sucesso", 
                novoSaldo: user.saldo,
                cartelas: novasCartelas 
            });
        } else { 
            res.status(400).json({ message: "Saldo insuficiente" }); 
        }
    } catch (e) { res.status(500).json({ message: "Erro" }); }
});

// RANKING E OUTRAS ROTAS
app.get('/top-10', async (req, res) => {
    const topUsers = await User.find({}, 'name saldo').sort({ saldo: -1 }).limit(10);
    res.set('Access-Control-Allow-Origin', '*');
    res.json(topUsers);
});

app.get('/game-status', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json(jogo);
});

app.get('/users', async (req, res) => {
    const users = await User.find();
    res.set('Access-Control-Allow-Origin', '*');
    res.json(users);
});

app.post('/add-saldo', async (req, res) => {
    const { userId, amount } = req.body;
    const user = await User.findById(userId);
    user.saldo += amount;
    await user.save();
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ message: "OK" });
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
