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

const User = mongoose.model('User', new mongoose.Schema({
    name: String, 
    email: { type: String, unique: true }, 
    senha: { type: String },
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] },
    cartelasProximaRodada: { type: Array, default: [] }
}));

// Variáveis de controle
let jogo = { bolas: [], fase: 'aguardando', tempoRestante: 300, premioAcumulado: 0, ganhadorRodada: null };
let premioReservadoProxima = 0; // CAIXINHA DE DINHEIRO PARA O PRÓXIMO SORTEIO

// 3. LOOP DO CRONÔMETRO
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
    let intervalo = setInterval(async () => {
        if (jogo.bolas.length < 50 && jogo.fase === 'sorteio') {
            let num;
            do { num = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(num));
            jogo.bolas.push(num);

            const usuarios = await User.find({ "cartelas.0": { $exists: true } });
            for (let u of usuarios) {
                for (let cartela of u.cartelas) {
                    const ganhou = cartela.every(n => jogo.bolas.includes(n));
                    if (ganhou) {
                        await User.findByIdAndUpdate(u._id, { $inc: { saldo: jogo.premioAcumulado } });
                        jogo.ganhadorRodada = u.name;
                        jogo.fase = 'finalizado';
                        clearInterval(intervalo);
                        finalizarRodada(); // CHAMA A LIMPEZA E TRANSFERÊNCIA
                        return;
                    }
                }
            }
        } else {
            clearInterval(intervalo);
            jogo.fase = 'finalizado';
            finalizarRodada();
        }
    }, 4000);
}

// FUNÇÃO QUE JUNTA AS CARTELAS E O DINHEIRO PARA A PRÓXIMA RODADA
async function finalizarRodada() {
    setTimeout(async () => {
        // 1. Limpa quem jogou agora
        await User.updateMany({}, { cartelas: [] });

        // 2. Transfere cartelas da reserva para o jogo principal
        const emEspera = await User.find({ "cartelasProximaRodada.0": { $exists: true } });
        for (let userEsp of emEspera) {
            await User.findByIdAndUpdate(userEsp._id, {
                $set: { cartelas: userEsp.cartelasProximaRodada, cartelasProximaRodada: [] }
            });
        }

        // 3. PEGA O DINHEIRO DA CAIXINHA E JOGA NO NOVO PRÊMIO
        let valorParaNovaRodada = premioReservadoProxima;
        premioReservadoProxima = 0; // Zera a caixinha

        jogo = { 
            bolas: [], 
            fase: 'aguardando', 
            tempoRestante: 300, 
            premioAcumulado: valorParaNovaRodada, 
            ganhadorRodada: null 
        };
        console.log("Nova rodada iniciada. Prêmio inicial: R$" + valorParaNovaRodada);
    }, 15000);
}

// 4. ROTA DE COMPRA COM LÓGICA DE DINHEIRO RESERVADO
app.post('/comprar-com-saldo', async (req, res) => {
    const user = await User.findById(req.body.usuarioId);
    if (user && user.saldo >= 2) {
        user.saldo -= 2;
        
        let c = [];
        while(c.length < 10) {
            let n = Math.floor(Math.random() * 50) + 1;
            if(!c.includes(n)) c.push(n);
        }
        const novaCartela = c.sort((a,b)=>a-b);

        if (jogo.fase === 'sorteio') {
            // DINHEIRO E CARTELA VÃO PARA A PRÓXIMA RODADA
            user.cartelasProximaRodada.push(novaCartela);
            premioReservadoProxima += 1.5;
            await user.save();
            res.json({ msg: "Sorteio em andamento! Sua cartela e os R$ 1,50 do prêmio foram guardados para a PRÓXIMA rodada." });
        } else {
            // ENTRA NA RODADA ATUAL
            user.cartelas.push(novaCartela);
            jogo.premioAcumulado += 1.5;
            await user.save();
            res.json({ msg: "Cartela comprada! R$ 1,50 adicionados ao prêmio atual." });
        }
    } else res.status(400).send("Saldo insuficiente");
});

app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => res.json(await User.findById(req.params.id)));
app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json({ user: u }); else res.status(401).send();
});
app.post('/register', async (req, res) => {
    try {
        const u = new User({ name: req.body.name, email: req.body.email, senha: req.body.password });
        await u.save(); res.json({ok:true});
    } catch(e) { res.status(400).send(); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bingo rodando!`));
    
