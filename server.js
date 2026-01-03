const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

app.use(express.json());
app.use(cors());

// 1. CONFIGURAÇÃO MERCADO PAGO (TOKEN OFICIAL)
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});

// 2. CONEXÃO MONGO (VARIÁVEL DE AMBIENTE)
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Conectado ao MongoDB com sucesso!"))
    .catch(err => console.error("Erro ao conectar no MongoDB:", err));

const User = mongoose.model('User', new mongoose.Schema({
    name: String, 
    email: { type: String, unique: true }, 
    senha: { type: String },
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };

// 3. LOOP DE TEMPO DO JOGO
setInterval(() => {
    if (jogo.fase === 'aguardando') {
        if (jogo.tempoRestante > 0) { jogo.tempoRestante--; } 
        else { jogo.fase = 'sorteio'; iniciarSorteio(); }
    }
}, 1000);

function iniciarSorteio() {
    console.log("Iniciando sorteio...");
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
                console.log("Rodada resetada.");
            }, 60000);
        }
    }, 4000);
}

// 4. ROTA DE DEPÓSITO (MÍNIMO R$ 10)
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    if (!userId || Number(valor) < 10) return res.status(400).json({ erro: "Dados inválidos ou valor mínimo de R$ 10" });

    const payment = new Payment(client);
    try {
        const result = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: `Depósito Bingo Real`,
                payment_method_id: 'pix',
                payer: { email: 'contato@bingoreal.com' },
                metadata: { user_id: userId } // Crucial para o Webhook identificar o dono do dinheiro
            }
        });

        console.log(`PIX Gerado para o usuário: ${userId}`);
        res.json({
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { 
        console.error("Erro ao gerar PIX:", e);
        res.status(500).json(e); 
    }
});

// 5. WEBHOOK AUTOMÁTICO (DINHEIRO REAL)
app.post('/webhook', async (req, res) => {
    const { data, type } = req.body;

    if (type === 'payment') {
        try {
            const payment = new Payment(client);
            const p = await payment.get({ id: data.id });

            if (p.status === 'approved') {
                const userId = p.metadata.user_id;
                const valorRecebido = p.transaction_amount;

                console.log(`PAGAMENTO APROVADO: Usuário ${userId} - R$ ${valorRecebido}`);

                // Atualiza o saldo no banco de dados
                await User.findByIdAndUpdate(userId, { $inc: { saldo: valorRecebido } });
                console.log("Saldo atualizado no MongoDB com sucesso.");
            }
        } catch (e) { 
            console.error("Erro ao processar Webhook:", e.message); 
        }
    }
    // Sempre retorne 200 para o Mercado Pago
    res.sendStatus(200);
});

// 6. ROTA DE SAQUE (MÍNIMO R$ 20)
app.post('/solicitar-saque', async (req, res) => {
    const { userId, valor, chavePix } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user || user.saldo < Number(valor)) return res.status(400).json({ erro: "Saldo insuficiente" });
        if (Number(valor) < 20) return res.status(400).json({ erro: "Saque mínimo R$ 20" });

        user.saldo -= Number(valor);
        await user.save();
        console.log(`PEDIDO DE SAQUE: ${user.name} | R$ ${valor} | Chave: ${chavePix}`);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ erro: "Erro ao processar saque" }); }
});

// 7. DEMAIS ROTAS
app.get('/game-status', (req, res) => res.json(jogo));

app.get('/user-data/:id', async (req, res) => {
    try { res.json(await User.findById(req.params.id)); } catch(e) { res.status(404).send(); }
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json({ user: u }); else res.status(401).send();
});

app.post('/register', async (req, res) => {
    try {
        const u = new User(req.body); 
        await u.save(); 
        res.json({ok:true});
    } catch(e) { res.status(400).json({erro: "Email já cadastrado"}); }
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

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Bingo rodando na porta ${PORT}`));
