const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-8763595166258074-051810-7561f584732103328e75927572635941-1815152179' 
});
const payment = new Payment(client);

app.post('/gerar-pix', async (req, res) => {
    try {
        const { valor } = req.body;
        const body = {
            transaction_amount: parseFloat(valor),
            description: 'Depósito Bingo Real',
            payment_method_id: 'pix',
            payer: { email: 'emanntossilva@gmail.com' } 
        };

        const response = await payment.create({ body });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            pix_copia_cola: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor Online'));
