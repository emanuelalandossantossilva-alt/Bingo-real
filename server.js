const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

app.use(express.json());
app.use(cors());

// CONFIGURAÇÃO MERCADO PAGO (TOKEN OFICIAL)
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});

// CONEXÃO MONGO (VARIÁVEL DE AMBIENTE)
mongoose.connect(process.env.MONGODB_URI);

const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, senha: { type: String },
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };

// LOOP DE TEMPO DO JOGO
setInterval(() => {
    if (jogo.fase === 'aguardando') {
        if (jogo.tempoRestante > 0) { jogo.tempoRestante--; } 
        else { jogo.fase = 'sorteio'; iniciarSorteio(); }
    }
}, 1000);

function iniciarSorteio() {
    let intervalo = setInterval(() => {
        if (jogo.bolas.length < 50) {
            let num;
            do { num = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(num));
            jogo.bolas.push(num);
        } else {
            clearInterval(intervalo);
            setTimeout(async () => {
                await User.updateMany({}, { cartelas: [] });
                jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };
            }, 60000);
        }
    }, 4000);
}

// --- ROTA DE DEPÓSITO (MÍNIMO R$ 10) ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    if (Number(valor) < 10) return res.status(400).json({ erro: "Mínimo R$ 10" });

    const payment = new Payment(client);
    try {
        const result = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: `Depósito Bingo Real`,
                payment_method_id: 'pix',
                payer: { email: 'contato@bingoreal.com' },
                metadata: { user_id: userId }
            }
        });
        res.json({
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).json(e); }
});

// --- WEBHOOK AUTOMÁTICO ---
app.post('/webhook', async (req, res) => {
    const { data, type } = req.body;
    if (type === 'payment') {
        try {
            const payment = new Payment(client);
            const p = await payment.get({ id: data.id });
            if (p.status === 'approved') {
                const userId = p.metadata.user_id;
                await User.findByIdAndUpdate(userId, { $inc: { saldo: p.transaction_amount } });
            }
        } catch (e) { console.error("Erro no Webhook"); }
    }
    res.sendStatus(200);
});

// --- ROTA DE SAQUE (MÍNIMO R$ 20) ---
app.post('/solicitar-saque', async (req, res) => {
    const { userId, valor, chavePix } = req.body;
    const user = await User.findById(userId);
    if (!user || user.saldo < Number(valor)) return res.status(400).json({ erro: "Saldo insuficiente" });
    if (Number(valor) < 20) return res.status(400).json({ erro: "Saque mínimo R$ 20" });

    user.saldo -= Number(valor);
    await user.save();
    console.log(`PEDIDO DE SAQUE: ${user.name} | R$ ${valor} | Chave: ${chavePix}`);
    res.json({ ok: true });
});

// --- RANKING E OUTRAS ROTAS ---
app.get('/ranking-bingo', async (req, res) => {
    const usuarios = await User.find();
    let ranking = usuarios.map(u => {
        let maior = 0;
        u.cartelas.forEach(c => {
            let acertos = c.filter(n => jogo.bolas.includes(n)).length;
            if (acertos > maior) maior = acertos;
        });
        return { name: u.name, acertos: maior };
    });
    res.json(ranking.sort((a,b) => b.acertos - a.acertos).slice(0, 10));
});

app.post('/comprar-com-saldo', async (req, res) => {
    const user = await User.findById(req.body.usuarioId);
    if (user && user.saldo >= 2) {
        user.saldo -= 2;
        jogo.premioAcumulado += 1.5;
        let c = [];
        while(c.length < 10) {
            let n = Math.floor(Math.random() * 50) + 1;
            if(!c.includes(n)) c.push(n);
        }
        user.cartelas.push(c.sort((a,b)=>a-b));
        await user.save();
        res.json({ cartelas: [c] });
    } else res.status(400).send();
});

app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => res.json(await User.findById(req.params.id)));
app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json({ user: u }); else res.status(401).send();
});
app.post('/register', async (req, res) => {
    const u = new User(req.body); await u.save(); res.json({ok:true});
});

app.listen(process.env.PORT || 3000);
