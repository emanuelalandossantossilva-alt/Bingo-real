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
    name: String, email: { type: String, unique: true }, senha: { type: String },
    saldo: { type: Number, default: 0 }, cartelas: { type: Array, default: [] },
    cartelasProximaRodada: { type: Array, default: [] }
}));

const Saque = mongoose.model('Saque', new mongoose.Schema({
    userId: String, userName: String, valor: Number, chavePix: String,
    status: { type: String, default: 'pendente' }, data: { type: Date, default: Date.now }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0, ganhadorRodada: null };
let premioReservadoProxima = 0;

// --- GERAÇÃO DE PIX ---
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
                external_reference: userId // GUARDAMOS O ID AQUI PARA O WEBHOOK ACHAR DEPOIS
            }
        });
        res.json({
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
            qr_code: result.point_of_interaction.transaction_data.qr_code
        });
    } catch (error) { res.status(500).json({ erro: "Erro PIX" }); }
});

// --- WEBHOOK CORRIGIDO (SALDO CAI AQUI) ---
app.post('/webhook', async (req, res) => {
    const { action, data, type } = req.body;
    
    // O Mercado Pago pode enviar o ID de várias formas, aqui pegamos todas
    const id = (data && data.id) || req.query["data.id"] || (req.body.resource && req.body.resource.split('/').pop());

    if (id) {
        try {
            const payment = new Payment(client);
            const p = await payment.get({ id });
            
            if (p.status === 'approved') {
                const valorPago = p.transaction_amount;
                const emailUsuario = p.payer.email;
                
                // Tenta achar pelo ID que salvamos ou pelo E-mail
                const user = await User.findOneAndUpdate(
                    { $or: [{ _id: p.external_reference }, { email: emailUsuario }] }, 
                    { $inc: { saldo: valorPago } },
                    { new: true }
                );
                
                if (user) console.log(`Sucesso: R$ ${valorPago} adicionado para ${user.name}`);
            }
        } catch (e) { console.error("Erro no processamento do Webhook:", e); }
    }
    res.sendStatus(200); // Sempre avisar ao Mercado Pago que recebemos o aviso
});

// CRONÔMETRO E SORTEIO (MANTIDOS IGUAIS)
setInterval(() => {
    if (jogo.fase === 'aguardando') {
        if (jogo.tempoRestante > 0) jogo.tempoRestante--;
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
            await User.findByIdAndUpdate(userEsp._id, {
                $set: { cartelas: userEsp.cartelasProximaRodada, cartelasProximaRodada: [] }
            });
        }
        jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: premioReservadoProxima, ganhadorRodada: null };
        premioReservadoProxima = 0;
    }, 15000);
}

// COMPRA DE CARTELAS
app.post('/comprar-com-saldo', async (req, res) => {
    const user = await User.findById(req.body.usuarioId);
    if (user && user.saldo >= 2) {
        user.saldo -= 2;
        let c = [];
        while(c.length < 10) { let n = Math.floor(Math.random() * 50) + 1; if(!c.includes(n)) c.push(n); }
        
        if (jogo.fase === 'sorteio' || jogo.fase === 'finalizado') { 
            user.cartelasProximaRodada.push(c); 
            premioReservadoProxima += 1.5; 
        } else { 
            user.cartelas.push(c); 
            jogo.premioAcumulado += 1.5; 
        }
        
        await user.save();
        res.json({ msg: "OK", totalCartelasAtivas: user.cartelas.length });
    } else res.status(400).send("Saldo insuficiente");
});

// ROTAS DE STATUS
app.get('/game-status', (req, res) => {
    // Adicionamos o total de cartelas do jogo para o HTML ler o prêmio
    res.json({
        ...jogo,
        totalCartelasAtivas: (jogo.premioAcumulado / 1.5)
    });
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));

