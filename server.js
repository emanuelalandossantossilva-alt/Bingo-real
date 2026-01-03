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
    .then(() => console.log("Conectado ao MongoDB com sucesso!"))
    .catch(err => console.error("Erro ao conectar no MongoDB:", err));

const User = mongoose.model('User', new mongoose.Schema({
    name: String, 
    email: { type: String, unique: true }, 
    senha: { type: String },
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0, ganhadorRodada: null };

// 3. LOOP DE TEMPO DO JOGO
setInterval(() => {
    if (jogo.fase === 'aguardando') {
        if (jogo.tempoRestante > 0) { jogo.tempoRestante--; } 
        else { 
            jogo.fase = 'sorteio'; 
            jogo.bolas = [];
            jogo.ganhadorRodada = null;
            iniciarSorteio(); 
        }
    }
}, 1000);

function iniciarSorteio() {
    console.log("Iniciando sorteio...");
    let intervalo = setInterval(async () => {
        if (jogo.bolas.length < 50 && jogo.fase === 'sorteio') {
            let num;
            do { num = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(num));
            jogo.bolas.push(num);

            // VERIFICAÇÃO DE GANHADOR (CARTELA CHEIA)
            const usuarios = await User.find({ "cartelas.0": { $exists: true } });
            
            for (let u of usuarios) {
                for (let cartela de u.cartelas) {
                    const ganhou = cartela.every(n => jogo.bolas.includes(n));
                    if (ganhou) {
                        console.log(`GANHADOR: ${u.name} levou R$ ${jogo.premioAcumulado}`);
                        
                        // Credita o prêmio no saldo do vencedor
                        await User.findByIdAndUpdate(u._id, { $inc: { saldo: jogo.premioAcumulado } });
                        
                        jogo.ganhadorRodada = u.name;
                        jogo.fase = 'finalizado';
                        clearInterval(intervalo);
                        
                        // Reset após 15 segundos
                        setTimeout(async () => {
                            await User.updateMany({}, { cartelas: [] });
                            jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0, ganhadorRodada: null };
                        }, 15000);
                        return;
                    }
                }
            }
        } else {
            clearInterval(intervalo);
            jogo.fase = 'finalizado';
            setTimeout(async () => {
                await User.updateMany({}, { cartelas: [] });
                jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };
            }, 10000);
        }
    }, 4000);
}

// 4. RANKING - CARTELAS MAIS MARCADAS
app.get('/ranking-bingo', async (req, res) => {
    try {
        const usuarios = await User.find({ "cartelas.0": { $exists: true } });
        let ranking = [];

        usuarios.forEach(u => {
            let melhorCartela = 0;
            u.cartelas.forEach(c => {
                let acertos = c.filter(n => jogo.bolas.includes(n)).length;
                if (acertos > melhorCartela) melhorCartela = acertos;
            });
            if (melhorCartela > 0) {
                ranking.push({ name: u.name, acertos: melhorCartela });
            }
        });

        // Ordena do maior para o menor número de marcados
        ranking.sort((a, b) => b.acertos - a.acertos);
        res.json(ranking.slice(0, 10));
    } catch (e) { res.status(500).send(); }
});

// 5. ROTA DE DEPÓSITO
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    if (!userId || Number(valor) < 10) return res.status(400).json({ erro: "Mínimo R$ 10" });
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

// 6. WEBHOOK MERCADO PAGO
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
        } catch (e) { console.error("Erro Webhook"); }
    }
    res.sendStatus(200);
});

// 7. ROTAS DE USUÁRIO E JOGO
app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => res.json(await User.findById(req.params.id)));

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json({ user: u }); else res.status(401).send();
});

app.post('/register', async (req, res) => {
    try {
        const u = new User({ name: req.body.name, email: req.body.email, senha: req.body.password });
        await u.save(); 
        res.json({ok:true});
    } catch(e) { res.status(400).send(); }
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

app.post('/solicitar-saque', async (req, res) => {
    const { userId, valor, chavePix } = req.body;
    const user = await User.findById(userId);
    if (!user || user.saldo < Number(valor)) return res.status(400).json({ erro: "Saldo insuficiente" });
    user.saldo -= Number(valor);
    await user.save();
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
         
