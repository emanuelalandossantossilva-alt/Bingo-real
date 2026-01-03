const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

app.use(express.json());
app.use(cors());

// CONFIGURAÇÃO MERCADO PAGO COM SEU TOKEN
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' });

mongoose.connect(process.env.MONGODB_URI);

const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, senha: { type: String },
    saldo: { type: Number, default: 0 }, cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0 };

// --- ROTA PARA GERAR O PIX ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    const payment = new Payment(client);
    try {
        const result = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: `Recarga Bingo - ID: ${userId}`,
                payment_method_id: 'pix',
                payer: { email: 'cliente@bingoreal.com' },
                metadata: { user_id: userId } // Guarda o ID do usuário no pagamento
            }
        });
        res.json({
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).json(e); }
});

// --- WEBHOOK (O SALDO CAI AQUI SOZINHO) ---
app.post('/webhook', async (req, res) => {
    const { data } = req.body;
    if (req.body.type === 'payment') {
        const payment = new Payment(client);
        const p = await payment.get({ id: data.id });
        if (p.status === 'approved') {
            const userId = p.metadata.user_id;
            const valor = p.transaction_amount;
            await User.findByIdAndUpdate(userId, { $inc: { saldo: valor } });
        }
    }
    res.sendStatus(200);
});

// (Mantenha aqui as outras rotas: /game-status, /ranking-bingo, /comprar-com-saldo, etc., que te mandei antes)

app.listen(process.env.PORT || 3000);
