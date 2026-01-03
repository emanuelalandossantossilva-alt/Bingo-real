const API = "https://bingo-backend-89dt.onrender.com";
let USER_ID = localStorage.getItem('userId');

// 1. FUNÇÃO PARA CONTROLAR AS TELAS (Login, Cadastro ou Jogo)
function mostrarTela(id) {
    document.getElementById('telaLogin').classList.add('hidden');
    document.getElementById('telaCadastro').classList.add('hidden');
    document.getElementById('telaJogo').classList.add('hidden');
    document.getElementById(id).classList.remove('hidden');
}

// 2. CARREGAR DADOS DO SERVIDOR (Cronômetro, Prêmio e Saldo)
async function carregarDados() {
    try {
        const resStatus = await fetch(`${API}/game-status`);
        if (!resStatus.ok) throw new Error("Erro de conexão");
        const jogo = await resStatus.json();

        // Atualiza o Cronômetro
        const timerElemento = document.getElementById('timerTxt');
        let min = Math.floor(jogo.tempoRestante / 60);
        let seg = jogo.tempoRestante % 60;
        
        if (jogo.fase === 'sorteio') {
            timerElemento.innerText = "SORTEANDO!";
            timerElemento.style.color = "#facc15";
        } else {
            timerElemento.innerText = `${min < 10 ? '0'+min : min}:${seg < 10 ? '0'+seg : seg}`;
            timerElemento.style.color = "#4ade80";
        }

        // Lógica do Prêmio Acumulando
        const premioElemento = document.getElementById('premioTxt');
        if (jogo.fase === 'aguardando') {
            premioElemento.innerText = "ACUMULANDO...";
        } else {
            premioElemento.innerText = `R$ ${jogo.premioAcumulado.toFixed(2)}`;
        }

        // Atualiza Ranking Top 10
        const resRank = await fetch(`${API}/top-10`);
        const rank = await resRank.json();
        document.getElementById('listaRanking').innerHTML = rank.map((u, i) => `
            <div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom: 1px solid #334155;">
                <span>${i+1}º ${u.name}</span>
                <span style="color:#22c55e">R$ ${u.saldo.toFixed(2)}</span>
            </div>
        `).join('');

        // Se houver bolas sendo sorteadas (Limite 50)
        if(jogo.bolas.length > 0) {
            document.getElementById('bolasSorteadas').innerHTML = jogo.bolas.map(b => `
                <div style="background:#facc15; color:black; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${b}</div>
            `).join('');
        }

        // Dados do Usuário Logado
        if (USER_ID) {
            const resUser = await fetch(`${API}/user-data/${USER_ID}`);
            const user = await resUser.json();
            document.getElementById('nomePlayer').innerText = user.name.toUpperCase();
            document.getElementById('saldoTxt').innerText = `R$ ${user.saldo.toFixed(2)}`;
        }

    } catch (e) {
        console.log("Tentando conectar ao servidor...");
        document.getElementById('timerTxt').innerText = "CONECTANDO...";
    }
}

// 3. COMPRAR CARTELA (Regra: R$ 2,00 e 10 números)
async function comprarCartela() {
    if (!USER_ID) return alert("Faça login primeiro!");
    
    try {
        const res = await fetch(`${API}/comprar-com-saldo`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuarioId: USER_ID, quantidade: 1 })
        });
        
        if (res.ok) {
            const data = await res.json();
            const div = document.createElement('div');
            div.className = 'cartela';
            // Desenha a cartela com os 10 números gerados
            div.innerHTML = data.cartelas[0].map(n => `<div>${n}</div>`).join('');
            document.getElementById('minhasCartelas').prepend(div);
            alert("Cartela comprada com sucesso!");
        } else {
            alert("Saldo insuficiente ou erro na compra!");
        }
    } catch (e) { alert("Erro ao conectar com o servidor."); }
}

// 4. LOGIN E CADASTRO
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, senha })
    });
    const data = await res.json();
    if(res.ok) {
        localStorage.setItem('userId', data.user._id);
        USER_ID = data.user._id;
        location.reload(); 
    } else { alert("Dados incorretos!"); }
}

async function fazerCadastro() {
    const dados = {
        name: document.getElementById('cadNome').value,
        email: document.getElementById('cadEmail').value,
        senha: document.getElementById('cadSenha').value
    };
    const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(dados)
    });
    if(res.ok) { alert("Conta criada!"); mostrarTela('telaLogin'); }
    else { alert("Erro no cadastro."); }
}

async function solicitarPix() {
    await fetch(`${API}/solicitar-pix`, { method: 'POST' });
    alert("Solicitação enviada ao Gerente Emanuel!");
}

function logout() {
    localStorage.clear();
    location.reload();
}

// INICIALIZAÇÃO
if (USER_ID) {
    mostrarTela('telaJogo');
    setInterval(carregarDados, 2000); // Atualiza tudo a cada 2 segundos
    carregarDados();
} else {
    mostrarTela('telaLogin');
}
