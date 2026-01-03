// NOVO RANKING: QUEM ESTÁ MAIS PERTO DE GANHAR
app.get('/ranking-bingo', async (req, res) => {
    try {
        const usuarios = await User.find();
        let ranking = [];

        usuarios.forEach(u => {
            // Se o usuário não tem cartelas, acertos é 0
            if (!u.cartelas || u.cartelas.length === 0) {
                ranking.push({ name: u.name, acertos: 0 });
            } else {
                // Vê qual das cartelas dele tem mais acertos
                let maiorAcerto = 0;
                u.cartelas.forEach(cartela => {
                    let acertosNaCartela = cartela.filter(num => jogo.bolas.includes(num)).length;
                    if (acertosNaCartela > maiorAcerto) maiorAcerto = acertosNaCartela;
                });
                ranking.push({ name: u.name, acertos: maiorAcerto });
            }
        });

        // Organiza do maior para o menor (quem marcou mais números primeiro)
        ranking.sort((a, b) => b.acertos - a.acertos);
        res.json(ranking.slice(0, 10)); // Manda só o Top 10
    } catch (e) {
        res.status(500).json([]);
    }
});
