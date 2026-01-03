const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// 1. CONEXÃO COM BANCO DE DADOS
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

// 3. ESTADO DO JOGO (50 BOLAS / CARTELA 10 NÚMEROS)
let jogo = { 
    bolas: [], 
    fase: 'aguardando', 
    tempoRestante: 300, 
    premioAcumulado: 0 
};

// 4. LÓGICA DO CRONÔMETRO (O QUE FAZ O TEMPO DESCER)
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
            // Reinicia após 1 minuto de exibição dos resultados
            setTimeout(reiniciarJogo, 60000);
        }
    }, 4000); 
}

function reiniciarJogo() {
    jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };
}

// 5. ROTAS DE STATUS E RANKING
app.get('/game-status', (req, res) => {
    res.json(jogo);
});

app.get('/top-10', async (req, res) => {
    const topUsers = await User.find({}, 'name saldo').sort({ saldo: -1 }).limit(10);
    res.json(topUsers);
});

// 6. COMPRA DE CARTELA (CARTELA 2,00 | ACUMULADO 1,50)
app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId, quantidade } = req.body;
        const user = await User.findById(usuarioId);
        const custo = quantidade * 2;
        
        if (user && user.saldo >= custo) {
            user.saldo -= custo;
            await user.save();
            
            // Adiciona R$ 1,50 por cartela ao prêmio
            jogo.premioAcumulado += (quantidade * 1.5);

            // Gera cartelas de 10 números
            let novasCartelas = [];
            for(let i=0; i<quantidade; i++) {
                let nums = [];
                while(nums.length < 10) {
                    let n = Math.floor(Math.random() * 50) + 1;
                    if(!nums.includes(n)) nums.push(n);
                }
                novasCartelas.push(nums.sort((a,b) => a-b));
            }
            res.json({ message: "OK", novoSaldo: user.saldo, cartelas: novasCartelas });
        } else {
            res.status(400).json({ message: "Sem saldo" });
        }
    } catch (e) { res.status(500).json({ message: "Erro" }); }
});

// 7. LOGIN E CADASTRO
app.post('/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ message: "Criado" });
    } catch (e) { res.status(400).json({ message: "Erro" }); }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(user) res.json({ user });
    else res.status(401).json({ message: "Erro" });
});

app.get('/user-data/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    res.json(user);
});

// Rota do Gerente para adicionar saldo
app.get('/users', async (req, res) => {
    const users = await User.find();
    res.json(users);
});

app.post('/add-saldo', async (req, res) => {
    const { userId, amount } = req.body;
    const user = await User.findById(userId);
    user.saldo += amount;
    await user.save();
    res.json({ message: "OK" });
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor Online"));
