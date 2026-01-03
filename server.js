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

// MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, senha: { type: String },
    saldo: { type: Number, default: 0 }, cartelas: { type: Array, default: [] },
    cartelasProximaRodada: { type: Array, default: [] }
}));

// --- ROTA QUE GERA O PIX (CORRIGIDA) ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const user = await User.findById(userId);
        const payment = new Payment(client);
        
        const result = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: `Deposito Bingo - ${user.email}`,
                payment_method_id: 'pix',
                payer: { 
                    email: user.email,
                    first_name: user.name 
                },
                // ESTA LINHA ABAIXO É A MAIS IMPORTANTE:
                notification_url: 'https://bingo-backend-89dt.onrender.com/webhook' 
            }
        });

        res.json({
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
            qr_code: result.point_of_interaction.transaction_data.qr_code
        });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ erro: "Erro ao gerar PIX" }); 
    }
});

// --- O WEBHOOK (A PARTE QUE RECEBE O DINHEIRO) ---
app.post('/webhook', async (req, res) => {
    const { action, data, type } = req.body;

    // O Mercado Pago pode enviar como 'payment' ou 'payment.created'
    if (action === "payment.created" || type === "payment" || req.query["data.id"]) {
        const id = data ? data.id : req.query["data.id"];
        
        try {
            const payment = new Payment(client);
            const p = await payment.get({ id });

            if (p.status === 'approved') {
                const valorAprovado = p.transaction_amount;
                const emailPagador = p.payer.email;

                // Aqui ele procura o dono do e-mail e adiciona o saldo
                await User.findOneAndUpdate(
                    { email: emailPagador }, 
                    { $inc: { saldo: valorAprovado } }
                );
                console.log(`SUCESSO: R$ ${valorAprovado} adicionado para ${emailPagador}`);
            }
        } catch (e) {
            console.error("Erro ao processar Webhook:", e);
        }
    }
    res.sendStatus(200); // Responde 200 para o Mercado Pago parar de enviar
});

// ... (Mantenha o restante do seu código de sorteio e rotas abaixo igual)

