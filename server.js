const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO DO BANCO (Link que você enviou anteriormente)
const mongoURI = "mongodb+srv://emanntossilva_db_user:jdTfhDfvYbeSHnQH@cluster0.mxdnuqr.mongodb.net/bingo_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI).then(() => console.log("Bingo Conectado!"));

// MODELO DE USUÁRIO COM SALDO E CARTELAS
const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// VARIÁVEIS DO JOGO EM TEMPO REAL
let jogo = {
    bolas: [],
    fase: "acumulando", // acumulando ou sorteio
    premioAcumulado: 0,
    tempoSegundos: 300 // 5 minutos iniciais
};

// LÓGICA DO TIMER (Roda a cada segundo no servidor)
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
    } else if (jogo.fase === "acumulando") {
        jogo.fase = "sorteio"; // Inicia o sorteio quando o tempo acaba
    }
}, 1000);

// --- ROTAS DO JOGADOR ---

// Pega os dados do usuário (Saldo e Cartelas)
app.get('/user-data/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    res.json(user);
});

// Compra de cartelas usando o saldo
app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    const preco = quantidade * 2; // R$ 2,00 por cartela (exemplo)
    
    const user = await User.findById(usuarioId);
    if (user.saldo >= preco) {
        let novasCartelas = [];
        for(let i=0; i<quantidade; i++) {
            let numeros = [];
            while(numeros.length < 15) {
                let n = Math.floor(Math.random() * 50) + 1;
                if(!numeros.includes(n)) numeros.push(n);
            }
            novasCartelas.push(numeros);
        }
        await User.findByIdAndUpdate(usuarioId, { 
            $inc: { saldo: -preco },
            $push: { cartelas: { $each: novasCartelas } }
        });
        jogo.premioAcumulado += (preco * 0.7); // 70% vai para o prêmio
        res.json({ success: true });
    } else {
        res.status(400).json({ message: "Saldo insuficiente" });
    }
});

// Status Geral do Jogo (Bolas, Prêmio e Tempo)
app.get('/game-status', (req, res) => {
    res.json(jogo);
});

// --- ROTAS DO GERENTE ---

// Sorteia uma bola e atualiza o jogo
app.post('/admin/draw', (req, res) => {
    if (jogo.bolas.length >= 50) return res.json({ message: "Fim" });
    let bola;
    do { bola = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);
    res.json({ bola });
});

// Reseta o jogo para uma nova rodada
app.post('/admin/reset', (req, res) => {
    jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };
    res.json({ success: true });
});

// Adiciona saldo (Injeção via Painel)
app.post('/admin/add-saldo', async (req, res) => {
    const { userId, valor } = req.body;
    await User.findByIdAndUpdate(userId, { $inc: { saldo: valor } });
    res.json({ success: true });
});

app.get('/admin/users', async (req, res) => {
    res.json(await User.find());
});

// Rotas de Registro e Login (Como antes)
app.post('/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json({ message: "Ok" });
    } catch (e) { res.status(400).json({ message: "Erro" }); }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(user) res.json(user); else res.status(401).json({ message: "Erro" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor Profissional Online"));
