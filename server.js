const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
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
