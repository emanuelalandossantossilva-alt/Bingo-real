const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// 1. CONEXÃO COM O MONGODB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Bingo Conectado!"))
  .catch(err => console.log("Erro de Conexão:", err));

// 2. MODELO DE USUÁRIO (Agora salva as cartelas para o Ranking)
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] } // Onde ficam os 10 números
}));

// 3. ESTADO DO JOGO (50 Bolas / 5 Minutos)
let jogo = { 
    bolas: [], 
    fase: 'aguardando', 
    tempoRestante: 300, 
    premioAcumulado: 0 
};

// 4. LÓGICA DO CRONÔMETRO
setInterval(() => {
    if (jogo.fase === 'aguardando') {
        if (jogo.tempoRestante > 0) {
            jogo.tempoRestante--;
        } else {
            jogo.fase = 'sorteio';
            iniciarSorteio();
        }
    }
}, 1000);

function iniciarSorteio() {
    let intervalo = setInterval(() => {
        if (jogo.bolas.length < 50) {
            let num;
            do { num = Math.floor(Math.random() * 50) + 1; } 
            while (jogo.bolas.includes(num));
            jogo.bolas.push(num);
        } else {
            clearInterval(intervalo);
            setTimeout(reiniciarJogo, 60000); // Reinicia após 1 min
        }
    }, 4000); 
}

async function reiniciarJogo() {
    // Quando o jogo reinicia, apaga as cartelas de todo mundo para o novo round
    await User.updateMany({}, { cartelas: [] });
    jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };
}

// 5. ROTA DO RANKING (QUEM MARCOU MAIS NÚMEROS)
app.get('/ranking-bingo', async (req, res) => {
    try {
        const usuarios = await User.find();
        let ranking = [];
        usuarios.forEach(u => {
            let maiorAcerto = 0;
            if (u.cartelas && u.cartelas.length > 0) {
                u.cartelas.forEach(cartela => {
                    let acertos = cartela.filter(n => jogo.bolas.includes(n)).length;
                    if (acertos > maiorAcerto) maiorAcerto = acertos;
                });
            }
            ranking.push({ name: u.name, acertos: maiorAcerto });
        });
        ranking.sort((a, b) => b.acertos - a.acertos);
        res.json(ranking.slice(0, 10));
    } catch (e) { res.json([]); }
});

// 6. COMPRA DE CARTELA (Desconta R$ 2,00 | Sobe R$ 1,50 | Salva 10 números)
app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId } = req.body;
    const user = await User.findById(usuarioId);
    if (user && user.saldo >= 2) {
        user.saldo -= 2;
        jogo.premioAcumulado += 1.5;

        // Gera 10 números entre 1 e 50
        let novaCartela = [];
        while(novaCartela.length < 10) {
            let n = Math.floor(Math.random() * 50) + 1;
            if(!novaCartela.includes(n)) novaCartela.push(n);
        }
        novaCartela.sort((a,b) => a-b);
        
        user.cartelas.push(novaCartela); // SALVA NO BANCO DE DADOS
        await user.save();
        res.json({ message: "OK", cartelas: [novaCartela] });
    } else {
        res.status(400).json({ message: "Saldo insuficiente" });
    }
});

// 7. ROTAS DE ACESSO E SALDO
app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.json({ok:true}); } 
    catch(e) { res.status(400).send(); }
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json({ user: u }); else res.status(401).send();
});

app.get('/game-status', (req, res) => res.json(jogo));

app.get('/user-data/:id', async (req, res) => {
    const u = await User.findById(req.params.id);
    res.json(u);
});

app.post('/add-saldo', async (req, res) => {
    const user = await User.findById(req.body.userId);
    user.saldo += req.body.amount;
    await user.save();
    res.json({ok:true});
});

app.listen(process.env.PORT || 3000);
