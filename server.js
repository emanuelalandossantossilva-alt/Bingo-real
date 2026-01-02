// Rota para o botão "USAR MEU SALDO" funcionar
app.post('/comprar-com-saldo', async (req, res) => {
    try {
        const { usuarioId, quantidade } = req.body;
        const valorTotal = quantidade * 2.0; // R$ 2,00 por cartela

        // Busca o jogador no banco de dados
        const user = await User.findById(usuarioId);
        
        if (user.saldo >= valorTotal) {
            user.saldo -= valorTotal; // Tira o dinheiro do saldo
            await user.save();
            
            // Avisa que deu certo
            res.json({ message: "Cartelas compradas com sucesso!" });
        } else {
            res.status(400).json({ message: "Saldo insuficiente!" });
        }
    } catch (error) {
        res.status(500).json({ message: "Erro ao processar compra" });
    }
});
