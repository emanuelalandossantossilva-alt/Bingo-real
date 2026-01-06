const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CONEXÃO COM O BANCO DE DADOS
const mongoURI = "mongodb+srv://emanntossilva_db_user:jdTfhDfvYbeSHnQH@cluster0.mxdnuqr.mongodb.net/bingo_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI).then(() => console.log("Servidor de Bingo Automático Online!"));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ESTADO INICIAL DO JOGO
let jogo = {
    bolas: [],
    fase: "acumulando", 
    premioAcumulado: 0,
    tempoSegundos: 300 // 5 minutos para apostas
};

// --- MOTOR AUTOMÁTICO DO BINGO ---
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        // Fase de contagem regressiva (Apostas abertas)
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        // O tempo acabou! Inicia o sorteio automático
        jogo.fase = "sorteio";
        
        // Sorteia uma bola a cada 10 segundos (se ainda não sorteou todas)
        // Usamos o resto da divisão por 10 para disparar o sorteio
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0)) {
            sortearBolaAutomatica();
        }
        
        jogo.tempoSegundos--; // Continua contando negativo para controlar o intervalo das bolas
    }
}, 1000);

function sortearBolaAutomatica() {
    let bola;
    if (jogo.bolas.length >= 50) return;
    
    do {
        bola = Math.floor(Math.random() * 50) + 1;
    } while (jogo.bolas.includes(bola));
    
    jogo.bolas.push(bola);
    console.log(`Bola sorteada automaticamente: ${bola}`);
}

// --- ROTAS PARA O HTML ---

app.get('/game-status', (req, res) => {
    res.json(jogo);
});

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).send(); }
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    if (jogo.fase !== "acumulando") return res.status(400).json({ message: "Sorteio em andamento" });

    const precoTotal = quantidade * 2;
    const user = await User.findById(usuarioId);

    if (user && user.saldo >= precoTotal) {
        let novasCartelas = [];
        for (let i = 0; i < quantidade; i++) {
            let nums = [];
            while (nums.length < 15) {
                let n = Math.floor(Math.random() * 50) + 1;
                if (!nums.includes(n)) nums.push(n);
            }
            novasCartelas.sort((a, b) => a - b);
            novasCartelas.push(nums);
        }

        await User.findByIdAndUpdate(usuarioId, {
            $inc: { saldo: -precoTotal },
            $push: { cartelas: { $each: novasCartelas } }
        });

        jogo.premioAcumulado += (precoTotal * 0.7);
        res.json({ success: true });
    } else {
        res.status(400).json({ message: "Saldo insuficiente" });
    }
});

// --- ROTAS DO GERENTE ---

app.post('/admin/add-saldo', async (req, res) => {
    const { userId, valor } = req.body;
    await User.findByIdAndUpdate(userId, { $inc: { saldo: valor } });
    res.json({ success: true });
});

app.get('/admin/users', async (req, res) => {
    res.json(await User.find());
});

app.post('/admin/reset', async (req, res) => {
    jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };
    // Limpa as cartelas de todos os usuários para a nova rodada
    await User.updateMany({}, { cartelas: [] });
    res.json({ success: true });
});

// AUTH
app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.status(201).json(u); }
    catch (e) { res.status(400).json({message: "Erro"}); }
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json(u); else res.status(401).json({message: "Erro"});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Bingo rodando na porta " + PORT));
