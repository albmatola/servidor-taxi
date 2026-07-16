const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Lista temporária de pedidos com estados financeiros
let pedidosDeTaxi = [];

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ROTA 1: Criar novo pedido com estimativa de tarifa
app.post('/api/pedir', (req, res) => {
    const { telefone, destino, latitude, longitude, distanciaEstimada } = req.body;

    if (!telefone || !latitude || !longitude) {
        return res.status(400).json({ erro: "Dados incompletos." });
    }

    // Cálculo simples: Taxa base de 150 MT + 50 MT por "unidade de distância" fictícia
    const distancia = distanciaEstimada || Math.random() * 5 + 1; // caso não venha distância, gera entre 1km e 6km
    const tarifaEstimada = Math.round(150 + (distancia * 50));

    const novoPedido = {
        id: pedidosDeTaxi.length + 1,
        telefone,
        destino: destino || "Não especificado",
        latitude,
        longitude,
        tarifa: tarifaEstimada,
        estado: "Pendente",         // Pendente, Aceite, Em Viagem, Aguardando_Pagamento, Pago
        pagamentoStatus: "Não Pago", // Não Pago, Processando, Pago
        data: new Date()
    };

    pedidosDeTaxi.push(novoPedido);
    console.log("Novo pedido com tarifa registado! 💰", novoPedido);

    res.status(201).json({ 
        mensagem: "Pedido registado!", 
        pedidoId: novoPedido.id,
        tarifa: tarifaEstimada 
    });
});

// ROTA 2: Listar todos os pedidos
app.get('/api/pedidos', (req, res) => {
    res.json(pedidosDeTaxi);
});

// ROTA 3: Consultar estado de um pedido específico (para o cliente verificar se já foi aceite ou pago)
app.get('/api/pedido/:id', (req, res) => {
    const pedido = pedidosDeTaxi.find(p => p.id === parseInt(req.params.id));
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
    res.json(pedido);
});

// ROTA 4: Alterar o estado da viagem (Aceitar, Iniciar, Concluir)
app.post('/api/pedido/:id/estado', (req, res) => {
    const { novoEstado } = req.body;
    const pedido = pedidosDeTaxi.find(p => p.id === parseInt(req.params.id));
    
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });

    pedido.estado = novoEstado;
    
    if (novoEstado === "Aguardando_Pagamento") {
        pedido.pagamentoStatus = "Processando";
    }

    console.log(`Pedido #${pedido.id} alterado para: ${novoEstado}`);
    res.json({ mensagem: "Estado atualizado!", pedido });
});

// ROTA 5: Simular confirmação de pagamento PIN M-Pesa/e-Mola pelo Cliente
app.post('/api/pedido/:id/pagar', (req, res) => {
    const { pin } = req.body;
    const pedido = pedidosDeTaxi.find(p => p.id === parseInt(req.params.id));
    
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
    if (!pin || pin.length < 4) return res.status(400).json({ erro: "PIN inválido." });

    pedido.estado = "Pago";
    pedido.pagamentoStatus = "Pago";

    console.log(`PAGAMENTO CONFIRMADO! 💳 Pedido #${pedido.id} pago via Mobile Money.`);
    res.json({ mensagem: "Pagamento processado com sucesso!", pedido });
});

app.listen(PORT, () => {
    console.log(`Servidor de Táxi a rodar na porta ${PORT} 🚀`);
});