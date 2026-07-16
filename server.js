const express = require('express');
const path = require('path');
const http = require('http'); // 👈 Importado para acoplar o Socket.io ao Express
const { Server } = require('socket.io'); // 👈 Importado para o tempo real

const app = express();
const server = http.createServer(app); // 👈 Criamos o servidor HTTP usando o Express
const io = new Server(server); // 👈 Inicializamos o Socket.io neste servidor

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
        pagamentoStatus: "Nenhum",
        codigoTransacao: null // 👈 Campo adicionado para registar a transferência manual
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

    // 📢 Avisa o Passageiro em tempo real que o motorista alterou o estado da viagem
    io.to(`viagem_${idPedido}`).emit('estado_alterado', { novoEstado, pedido });

    console.log(`Pedido #${pedido.id} alterado pelo motorista para: ${novoEstado}`);
    res.json({ mensagem: "Estado updated com sucesso!", pedido });
});

// ROTA 5: Simular confirmação de pagamento via PIN M-Pesa/e-Mola/mKesh pelo Cliente (POST)
app.post('/api/pedido/:id/pagar', (req, res) => {
    const idPedido = parseInt(req.params.id);
    const { pin } = req.body; 
    
    const pedido = pedidos.find(p => p.id === idPedido);
    if (!pedido) {
        return res.status(404).json({ erro: "Pedido não encontrado." });
    }

    // Tratamento robusto para garantir que o PIN é uma string antes de validar o comprimento
    const pinString = pin ? String(pin).trim() : "";

    if (pinString && (pinString.length < 4 || isNaN(pinString))) {
        return res.status(400).json({ erro: "PIN inválido. Introduz pelo menos 4 números." });
    }

    // Altera o estado do pedido e do pagamento de forma síncrona na memória
    pedido.estado = "Pago";
    pedido.pagamentoStatus = "Pago";

    // 📢 Avisa o Motorista em tempo real na sala de chat que o pagamento foi efetuado com sucesso!
    io.to(`viagem_${idPedido}`).emit('pagamento_confirmado', { pedido });

    console.log(`💳 [PAGAMENTO CONFIRMADO] Pedido #${pedido.id} de ${pedido.tarifa} MT pago via Mobile Money (PIN validado).`);
    res.json({ mensagem: "Pagamento processado com sucesso!", pedido });
});

// =========================================================================
// 🆕 ROTA 6: Receber Confirmação de Transferência Manual (Código de Transação)
// =========================================================================
app.post('/api/pedido/:id/confirmar-manual', (req, res) => {
    const idPedido = parseInt(req.params.id);
    const { codigoTransacao } = req.body;

    if (!codigoTransacao || codigoTransacao.trim() === "") {
        return res.status(400).json({ erro: "O código de transação é obrigatório." });
    }

    const pedido = pedidos.find(p => p.id === idPedido);
    if (!pedido) {
        return res.status(404).json({ erro: "Pedido não encontrado." });
    }

    if (pedido.estado !== "Aguardando_Pagamento") {
        return res.status(400).json({ erro: `Este pedido está no estado '${pedido.estado}' e não aguarda pagamento.` });
    }

    // Atualiza os dados do pedido com o código inserido
    pedido.codigoTransacao = codigoTransacao.trim().toUpperCase();
    pedido.estado = "Pago"; // Atualiza para Pago (ou podias criar um estado "Em_Verificacao" se o motorista validar)
    pedido.pagamentoStatus = "Pago";

    const nomeSala = `viagem_${idPedido}`;

    // 📢 Notifica o motorista em tempo real via canal de eventos de estado
    io.to(nomeSala).emit('pagamento_confirmado', { pedido });

    // 💬 Envia uma mensagem automática no chat para registar o comprovativo na conversa
    io.to(nomeSala).emit('mensagem_recebida', {
        pedidoId: idPedido,
        texto: `📢 [SISTEMA] O cliente confirmou o envio. Código de Transação: ${pedido.codigoTransacao}`,
        remetente: 'sistema'
    });

    console.log(`✅ [TRANSFERÊNCIA INFORMADA] Pedido #${idPedido} pago manualmente. Código: ${pedido.codigoTransacao}`);
    
    res.json({
        sucesso: true,
        mensagem: "Confirmação manual recebida com sucesso!",
        pedido
    });
});

// ==========================================
// 💬 CONFIGURAÇÃO DO SOCKET.IO (CHAT EM TEMPO REAL)
// ==========================================
io.on('connection', (socket) => {
    console.log(`🔌 Novo utilizador ligado ao Socket: ${socket.id}`);

    // 1. Entrar na sala do chat específica daquela viagem
    socket.on('entrar_chat', (dados) => {
        const { pedidoId, utilizador } = dados;
        const nomeSala = `viagem_${pedidoId}`;
        
        socket.join(nomeSala);
        console.log(`👥 [${utilizador.toUpperCase()}] entrou na sala do chat: ${nomeSala}`);
    });

    // 2. Receber a mensagem de um lado e retransmitir para o outro na mesma sala
    socket.on('enviar_mensagem', (dados) => {
        const { pedidoId, texto, remetente } = dados;
        const nomeSala = `viagem_${pedidoId}`;

        console.log(`💬 Mensagem em [${nomeSala}] de [${remetente}]: "${texto}"`);

        // Envia para TODOS os utilizadores na sala (incluindo o que enviou)
        // Usar "io.to" garante que ambos os lados recebem o sinal em tempo real
        io.to(nomeSala).emit('mensagem_recebida', {
            pedidoId: pedidoId,
            texto: texto,
            remetente: remetente
        });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Utilizador desligado do Socket: ${socket.id}`);
    });
});

// ==========================================
// 🚀 INICIALIZAÇÃO DO SERVIDOR (com "server" em vez de "app")
// ==========================================
server.listen(PORT, () => {
    console.log(`Servidor de Táxi do TaxiExpress a rodar na porta ${PORT} 🚀`);
});