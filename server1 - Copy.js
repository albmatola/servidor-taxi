const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Lista temporária em memória para guardar os pedidos de táxi
let pedidosDeTaxi = [];

// Permite que o servidor leia dados enviados em formato JSON
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Página Inicial do Cliente
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ROTA 1: Receber um novo pedido de táxi do cliente
app.post('/api/pedir', (req, res) => {
    const { telefone, destino, latitude, longitude } = req.body;

    if (!telefone || !latitude || !longitude) {
        return res.status(400).json({ erro: "Dados incompletos para o pedido." });
    }

    const novoPedido = {
        id: pedidosDeTaxi.length + 1,
        telefone,
        destino: destino || "Não especificado",
        latitude,
        longitude,
        estado: "Pendente", // Pode ser: Pendente, Aceite, Concluído
        data: new Date()
    };

    pedidosDeTaxi.push(novoPedido);
    console.log("Novo pedido recebido no servidor! 🚖", novoPedido);

    res.status(201).json({ mensagem: "Pedido registado com sucesso!", pedidoId: novoPedido.id });
});

// ROTA 2: Listar todos os pedidos (útil para o painel do motorista que vamos criar a seguir)
app.get('/api/pedidos', (req, res) => {
    res.json(pedidosDeTaxi);
});

app.listen(PORT, () => {
    console.log(`Servidor de Táxi a rodar na porta ${PORT} 🚀`);
});