const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

app.use(express.json());
app.use(cors());

// 1. CONFIGURAÇÃO MERCADO PAGO
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});

// 2. CONEXÃO MONGO
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Conectado ao MongoDB!"))
    .catch(err => console.error("Erro Mongo:", err));

// MODELOS
const User = mongoose.model('User', new mongoose.Schema({
    name: { type: String, unique: true }, 
    email: { type: String, unique: true }, 
    senha: { type: String },
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] },
    cartelasProximaRodada: { type: Array, default: [] }
}));

const Saque = mongoose.model('Saque', new mongoose.Schema({
    userId: String, userName: String, valor: Number, chavePix: String,
    status: { type: String, default: 'pendente' }, data: { type: Date, default: Date.now }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoSegundos: 300, premioAcumulado: 0, ganhadorRodada: null };
let premioReservadoProxima = 0;

// --- ROTAS DO GERENTE (ADMIN) ---

app.get('/admin/usuarios', async (req, res) => {
    try {
        const users = await User.find({}, 'name email saldo cartelas cartelasProximaRodada');
        res.json(users);
    } catch (e) { res.status(500).send("Erro"); }
});

app.post('/admin/add-saldo', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const user = await User.findByIdAndUpdate(userId, { $inc: { saldo: Number(valor) } }, { new: true });
        if(user) res.json({ msg: "Saldo adicionado!", novoSaldo: user.saldo });
        else res.status(404).send("Usuário não encontrado");
    } catch (e) { res.status(500).send("Erro"); }
});

// NOVA ROTA: ALTERAR SENHA (ADICIONADA)
app.post('/admin/alterar-senha', async (req, res) => {
    const { userId, novaSenha } = req.body;
    try {
        const user = await User.findByIdAndUpdate(userId, { senha: novaSenha }, { new: true });
        if(user) res.json({ msg: "Senha alterada com sucesso!" });
        else res.status(404).send("Usuário não encontrado");
    } catch (e) { res.status(500).send("Erro"); }
});

// NOVA ROTA: EXCLUIR USUÁRIO (ADICIONADA)
app.delete('/admin/excluir-usuario/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const deletado = await User.findByIdAndDelete(userId);
        if(deletado) res.json({ msg: "Conta excluída permanentemente!" });
        else res.status(404).send("Usuário não encontrado");
    } catch (e) { res.status(500).send("Erro ao excluir"); }
});

app.post('/admin/reset-jogo', (req, res) => {
    jogo = { bolas: [], fase: 'aguardando', tempoSegundos: 300, premioAcumulado: 0, ganhadorRodada: null };
    premioReservadoProxima = 0;
    res.json({ msg: "Jogo reiniciado!" });
});

// --- ROTAS DO JOGO ---

app.post('/atualizar-perfil', async (req, res) => {
    const { userId, nome } = req.body;
    try {
        const nomeExiste = await User.findOne({ name: nome, _id: { $ne: userId } });
        if (nomeExiste) return res.status(400).json({ erro: "Este nome já existe" });
        const user = await User.findByIdAndUpdate(userId, { name: nome }, { new: true });
        res.json({ msg: "OK", user });
    } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId } = req.body;
        const qtd = parseInt(req.body.quantidade) || 1; 
        const custoTotal = qtd * 2;
        const valorParaOPremeio = qtd * 1.5;

        const user = await User.findById(usuarioId);
        if (user && user.saldo >= custoTotal) {
            user.saldo -= custoTotal; 
            for (let i = 0; i < qtd; i++) {
                let c = [];
                while(c.length < 10) { 
                    let n = Math.floor(Math.random() * 50) + 1; 
                    if(!c.includes(n)) c.push(n); 
                }
                if (jogo.fase === 'sorteio' || jogo.fase === 'finalizado') { 
                    user.cartelasProximaRodada.push(c); 
                } else { 
                    user.cartelas.push(c); 
                }
            }
            if (jogo.fase === 'sorteio' || jogo.fase === 'finalizado') { 
                premioReservadoProxima += valorParaOPremeio; 
            } else { 
                jogo.premioAcumulado += valorParaOPremeio; 
            }
            await user.save();
            res.json({ msg: "OK", saldoRestante: user.saldo, premioAtual: jogo.premioAcumulado });
        } else { res.status(400).send("Saldo insuficiente"); }
    } catch (error) { res.status(500).send("Erro"); }
});

// LÓGICA DO SORTEIO
setInterval(() => {
    if (jogo.fase === 'aguardando') {
        if (jogo.tempoSegundos > 0) jogo.tempoSegundos--;
        else { jogo.fase = 'sorteio'; iniciarSorteio(); }
    }
}, 1000);

function iniciarSorteio() {
    let intervalo = setInterval(async () => {
        if (jogo.bolas.length < 50 && jogo.fase === 'sorteio') {
            let num;
            do { num = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(num));
            jogo.bolas.push(num);
            const usuarios = await User.find({ "cartelas.0": { $exists: true } });
            for (let u of usuarios) {
                for (let cartela of u.cartelas) {
                    if (cartela.every(n => jogo.bolas.includes(n))) {
                        await User.findByIdAndUpdate(u._id, { $inc: { saldo: jogo.premioAcumulado } });
                        jogo.ganhadorRodada = u.name;
                        jogo.fase = 'finalizado';
                        clearInterval(intervalo);
                        finalizarRodada();
                        return;
                    }
                }
            }
        } else { clearInterval(intervalo); jogo.fase = 'finalizado'; finalizarRodada(); }
    }, 4000);
}

function finalizarRodada() {
    setTimeout(async () => {
        await User.updateMany({}, { cartelas: [] });
        const emEspera = await User.find({ "cartelasProximaRodada.0": { $exists: true } });
        for (let userEsp of emEspera) {
            await User.findByIdAndUpdate(userEsp._id, { $set: { cartelas: userEsp.cartelasProximaRodada, cartelasProximaRodada: [] } });
        }
        jogo = { bolas: [], fase: 'aguardando', tempoSegundos: 300, premioAcumulado: premioReservadoProxima, ganhadorRodada: null };
        premioReservadoProxima = 0;
    }, 15000);
}

app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const user = await User.findById(userId);
        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Deposito Bingo Real',
                payment_method_id: 'pix',
                payer: { email: user.email },
                notification_url: 'https://bingo-backend-89dt.onrender.com/webhook',
                external_reference: userId
            }
        });
        res.json({ qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64, qr_code: result.point_of_interaction.transaction_data.qr_code });
    } catch (error) { res.status(500).json({ erro: "Erro PIX" }); }
});

app.post('/webhook', async (req, res) => {
    const { data } = req.body;
    const id = (data && data.id) || req.query["data.id"];
    if (id) {
        try {
            const payment = new Payment(client);
            const p = await payment.get({ id });
            if (p.status === 'approved') {
                await User.findOneAndUpdate({ $or: [{ _id: p.external_reference }, { email: p.payer.email }] }, { $inc: { saldo: p.transaction_amount } });
            }
        } catch (e) { console.error(e); }
    }
    res.sendStatus(200);
});

app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => res.json(await User.findById(req.params.id)));
app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json({ user: u }); else res.status(401).send();
});
app.post('/register', async (req, res) => {
    try { 
        const ex = await User.findOne({ name: req.body.name });
        if(ex) return res.status(400).json({ erro: "Nome já existe" });
        const u = new User({ name: req.body.name, email: req.body.email, senha: req.body.password }); 
        await u.save(); res.json({ok:true}); 
    } catch(e) { res.status(400).send(); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Porta ${PORT}`));

