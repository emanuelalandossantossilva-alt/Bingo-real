const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Conexão com o Banco de Dados
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Conectado"))
  .catch(err => console.log("Erro MongoDB:", err));

// Modelo de Usuário
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };

// --- LÓGICA DO CRONÔMETRO E SORTEIO (O QUE ESTAVA FALTANDO) ---
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
            setTimeout(reiniciarJogo, 30000); // Reinicia após 30 segundos
        }
    }, 4000); // Sorteia uma bola a cada 4 segundos
}

function reiniciarJogo() {
    jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };
}
// -----------------------------------------------------------

// Rota de Compra
app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId, quantidade } = req.body;
        const user = await User.findById(usuarioId);
        if (user.saldo >= (quantidade * 2)) {
            user.saldo -= (quantidade * 2);
            await user.save();
            jogo.premioAcumulado += (quantidade * 1);
            res.json({ message: "Sucesso" });
        } else { res.status(400).json({ message: "Saldo insuficiente" }); }
    } catch (e) { res.status(500).json({ message: "Erro" }); }
});

// Rota de Status
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

// Login e Registro
app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(user) res.json({ user });
    else res.status(401).json({ message: "Erro no login" });
});

app.post('/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ message: "Criado" });
    } catch (e) { res.status(400).json({ message: "Erro ao criar" }); }
});

app.listen(process.env.PORT || 3000);

