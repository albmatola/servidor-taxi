const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração dos Parsers para ler JSON e dados de formulários
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Diz ao Express para servir ficheiros estáticos (como CSS, JS e imagens) da raiz
app.use(express.static(__dirname));

// Array em memória unificado para guardar as viagens e o controle do ID
let pedidos = [];
let proximoId = 1;

// ==========================================
// 📂 ROTAS DE PÁGINAS (HTML)
// ==========================================

// Rota principal (Ecrã do Passageiro)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota dedicada para o Painel do Motorista (podes aceder via /motorista ou /motorista.html)
app.get('/motorista', (req, res) => {
    res.sendFile(path.join(__dirname, 'motorista.html'));
});

// ==========================================
// 🔌 APIS DO SISTEMA DE TÁXI
// ==========================================

// ROTA 1: Criar um Pedido (POST) - Chamada iniciada pelo Passageiro
app.post('/api/pedidos', (req, res) => {
    const { telefone, destino, latitude, longitude, tarifa } = req.body;

    if (!telefone || !destino) {
        return res.status(400).json({ erro: "Telefone e destino são obrigatórios." });
    }

    const novoPedido = {
        id: proximoId++,
        telefone,
        destino,
        latitude: latitude || -25.9692,
        longitude: longitude || 32.5732,
        tarifa: tarifa || 150, // Se não vier tarifa, assume a taxa base de 150 MT
        estado: "Pendente",
        pagamentoStatus: "Nenhum"
    };

    pedidos.push(novoPedido);
    console.log("Novo pedido recebido no sistema:", novoPedido);
    
    res.status(201).json(novoPedido);
});

// ROTA 2: Listar todos os pedidos (GET) - Usado pelo Painel do Motorista
app.get('/api/pedidos', (req, res) => {
    res.json(pedidos);
});

// ROTA 3: Consultar estado de um pedido específico (GET) - Usado pelo Passageiro para monitorização
app.get('/api/pedido/:id', (req, res) => {
    const idPedido = parseInt(req.params.id);
    const pedido = pedidos.find(p => p.id === idPedido);

    if (!pedido) {
        return res.status(404).json({ erro: "Pedido não encontrado." });
    }

    res.json(pedido);
});

// ROTA 4: Alterar o estado da viagem (POST) - Usado pelo Motorista para Aceitar, Iniciar e Concluir
app.post('/api/pedido/:id/estado', (req, res) => {
    const idPedido = parseInt(req.params.id);
    const { novoEstado } = req.body;
    
    const pedido = pedidos.find(p => p.id === idPedido);
    if (!pedido) {
        return res.status(404).json({ erro: "Pedido não encontrado." });
    }

    pedido.estado = novoEstado;

    if (novoEstado === "Aguardando_Pagamento") {
        pedido.pagamentoStatus = "Processando";
    }

    console.log(`Pedido #${pedido.id} alterado pelo motorista para: ${novoEstado}`);
    res.json({ mensagem: "Estado atualizado com sucesso!", pedido });
});

// ROTA 5: Simular confirmação de pagamento via PIN M-Pesa/e-Mola/mKesh pelo Cliente (POST)
app.post('/api/pedido/:id/pagar', (req, res) => {
    const idPedido = parseInt(req.params.id);
    const { pin } = req.body; // PIN opcional para testes ou simulações diretas
    
    const pedido = pedidos.find(p => p.id === idPedido);
    if (!pedido) {
        return res.status(404).json({ erro: "Pedido não encontrado." });
    }

    // Se um PIN for enviado, validamos (pelo menos 4 dígitos para segurança)
    // Se não for enviado (clique direto no botão simular), geramos um PIN simulado de autorização
    if (pin && pin.length < 4) {
        return res.status(400).json({ erro: "PIN inválido. Introduz pelo menos 4 dígitos." });
    }

    pedido.estado = "Pago";
    pedido.pagamentoStatus = "Pago";

    console.log(`💳 PAGAMENTO CONFIRMADO! Pedido #${pedido.id} de ${pedido.tarifa} MT pago via Mobile Money.`);
    res.json({ mensagem: "Pagamento processado com sucesso!", pedido });
});

// ==========================================
// 🚀 INICIALIZAÇÃO DO SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`Servidor de Táxi do TaxiExpress a rodar na porta ${PORT} 🚀`);
});