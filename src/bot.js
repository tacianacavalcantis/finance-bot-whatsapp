const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sheetsManager = require('./sheets');
const MessageParser = require('./parser');
const config = require('../config/config');
const logger = require('./logger');

class FinanceBot {
    constructor() {
        this.client = null;
        this.initialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
    }

    async initialize() {
        try {
            await sheetsManager.initialize();

            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: config.whatsapp.sessionDir
                }),
                puppeteer: config.whatsapp.puppeteer
            });

            this.setupEventHandlers();
            return true;
        } catch (error) {
            logger.error('Erro ao inicializar bot:', error);
            return false;
        }
    }

    // ✅ handleReconnect está FORA do setupEventHandlers
    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error(`Máximo de tentativas (${this.maxReconnectAttempts}) atingido. Encerrando.`);
            process.exit(1);
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        logger.info(`Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay / 1000}s...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await this.client.destroy();
        } catch (_) {}

        logger.info('Reiniciando cliente WhatsApp...');
        await this.initialize();
        await this.client.initialize();
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            logger.info('QR Code recebido, escaneie com WhatsApp');
            qrcode.generate(qr, { small: true });
        });

        // ✅ ready restaurado e com reset do contador
        this.client.on('ready', () => {
            logger.info('Bot WhatsApp conectado com sucesso!');
            this.initialized = true;
            this.reconnectAttempts = 0;
            this.sendStartupMessage();
        });

        this.client.on('message', async (message) => {
            await this.handleMessage(message);
        });

        this.client.on('authenticated', () => {
            logger.info('WhatsApp autenticado');
        });

        // ✅ disconnected único com reconexão
        this.client.on('disconnected', async (reason) => {
            logger.warn('WhatsApp desconectado:', reason);
            this.initialized = false;
            await this.handleReconnect();
        });
    }

    async sendStartupMessage() {
        for (const [numero, nome] of Object.entries(config.members)) {
            const numeroCompleto = `${numero}@c.us`;
            const mensagem = `🤖 *BOT FINANCEIRO FAMILIAR ATIVO!*\n\n` +
                `Olá ${nome}! Use os seguintes formatos:\n\n` +
                `💰 *RECEITA:*\n+200 freela deposito\n\n` +
                `💸 *DESPESA:*\n-25 padaria dinheiro\n` +
                `67 farmacia credito 3x\n\n` +
                `📊 *COMANDOS:*\n` +
                `• "resumo" - Ver resumo do mês\n` +
                `• "saldo" - Ver seu saldo\n` +
                `• "ajuda" - Ver esta mensagem`;

            await this.sendMessage(numeroCompleto, mensagem);
        }
    }

    async handleMessage(message) {
        try {
            const from = message.from;
            const body = message.body.toLowerCase().trim();
            const notifyName = message._data?.notifyName || '';
            const memberName = this.getMemberName(from, notifyName);

            logger.info('Dados da mensagem: ' + JSON.stringify({
                from: message.from,
                author: message.author,
                to: message.to,
                notifyName: message._data?.notifyName
            }));

            if (message.isGroupMsg) {
                return;
            }

            logger.info(`Mensagem de ${memberName}: ${body}`);

            if (body === 'resumo' || body === 'relatorio' || body === 'rel') {
                await this.handleResumo(from);
                return;
            }

            if (body === 'saldo' || body === 'balance') {
                await this.handleSaldo(from, memberName);
                return;
            }

            if (body === 'ajuda' || body === 'help' || body === 'comandos') {
                await this.handleAjuda(from);
                return;
            }

            const parsed = MessageParser.parseMessage(body, memberName);

            if (!parsed.success) {
                await this.sendMessage(from, `❌ ${parsed.error}\n\n📝 Exemplos:\n+200 freela deposito\n-25 padaria dinheiro\n67 farmacia credito 3x`);
                return;
            }

            const result = await sheetsManager.registrarTransacao(parsed.data);

            if (result.success) {
                const confirmacao = MessageParser.gerarConfirmacao(parsed.data);
                await this.sendMessage(from, confirmacao);

                if (result.isParcelado) {
                    await this.sendMessage(from, `📅 *${parsed.data.parcela}x parcelas* agendadas para os próximos meses.`);
                }

                await this.checkAlerts(from, memberName, parsed.data);
            } else {
                await this.sendMessage(from, `❌ Erro ao registrar: ${result.error}`);
            }

        } catch (error) {
            logger.error('Erro ao processar mensagem:', error);
            await this.sendMessage(message.from, '❌ Erro interno. Tente novamente mais tarde.');
        }
    }

    async handleResumo(from) {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

        const resumo = await sheetsManager.getResumoPeriodo(inicioMes, fimMes);

        if (!resumo.success) {
            await this.sendMessage(from, `❌ Erro ao gerar resumo: ${resumo.error}`);
            return;
        }

        const data = resumo.data;
        const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long' });

        let mensagem = `📊 *RESUMO ${nomeMes.toUpperCase()} ${hoje.getFullYear()}*\n`;
        mensagem += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        mensagem += `💰 *RECEITAS:* R$ ${data.totalReceitas.toFixed(2)}\n`;
        mensagem += `💸 *DESPESAS:* R$ ${data.totalDespesas.toFixed(2)}\n`;
        mensagem += `💵 *SALDO:* R$ ${data.saldoTotal.toFixed(2)}\n\n`;

        mensagem += `👥 *POR MEMBRO:*\n`;
        for (const [membro, valores] of Object.entries(data.resumoMembros)) {
            const emoji = valores.saldo >= 0 ? '🟢' : '🔴';
            mensagem += `${emoji} ${membro}: R$ ${valores.saldo.toFixed(2)}\n`;
        }

        mensagem += `\n💳 *GASTOS POR FORMA:*\n`;
        for (const [forma, valor] of Object.entries(data.resumoFormas)) {
            mensagem += `• ${forma}: R$ ${valor.toFixed(2)}\n`;
        }

        await this.sendMessage(from, mensagem);
    }

    async handleSaldo(from, memberName) {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

        const transacoes = await sheetsManager.getTransacoes({
            dataInicio: inicioMes,
            nome: memberName
        });

        if (!transacoes.success) {
            await this.sendMessage(from, `❌ Erro ao consultar saldo: ${transacoes.error}`);
            return;
        }

        const receitas = transacoes.data.filter(t => t.tipo === 'receita');
        const despesas = transacoes.data.filter(t => t.tipo === 'despesa');

        const totalReceitas = receitas.reduce((sum, t) => sum + t.valor, 0);
        const totalDespesas = despesas.reduce((sum, t) => sum + t.valor, 0);
        const saldo = totalReceitas - totalDespesas;

        let mensagem = `💰 *SEU SALDO - ${memberName}*\n`;
        mensagem += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        mensagem += `📈 Receitas: R$ ${totalReceitas.toFixed(2)}\n`;
        mensagem += `📉 Despesas: R$ ${totalDespesas.toFixed(2)}\n`;
        mensagem += `💵 Saldo: R$ ${saldo.toFixed(2)}\n\n`;

        if (saldo < 0) {
            mensagem += `⚠️ *ALERTA:* Você está com saldo negativo!\n`;
            mensagem += `Considere reduzir gastos este mês.`;
        } else if (saldo > 1000) {
            mensagem += `🎉 *Parabéns!* Você está com um bom saldo positivo!`;
        }

        await this.sendMessage(from, mensagem);
    }

    async handleAjuda(from) {
        const mensagem = `🤖 *BOT FINANCEIRO - AJUDA*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📝 *FORMATOS ACEITOS:*\n\n` +
            `💰 *RECEITA (use +):*\n` +
            `+200 freela deposito\n` +
            `+5000 salario pix\n\n` +
            `💸 *DESPESA (use - ou sem sinal):*\n` +
            `-25 padaria dinheiro\n` +
            `67 farmacia credito 3x\n` +
            `150 restaurante debito\n\n` +
            `📊 *COMANDOS:*\n` +
            `• "resumo" - Resumo do mês\n` +
            `• "saldo" - Seu saldo atual\n` +
            `• "ajuda" - Esta mensagem\n\n` +
            `💡 *FORMAS ACEITAS:*\n` +
            `dinheiro, debito, credito, pix, deposito, transferencia, boleto\n\n` +
            `📅 *PARCELAS:* Use "credito 3x" para parcelar em 3 vezes`;

        await this.sendMessage(from, mensagem);
    }

    async checkAlerts(from, memberName, transacao) {
        if (transacao.tipo !== 'despesa') return;

        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

        const despesas = await sheetsManager.getTransacoes({
            dataInicio: inicioMes,
            nome: memberName,
            tipo: 'despesa'
        });

        if (!despesas.success) return;

        const totalMes = despesas.data.reduce((sum, d) => sum + d.valor, 0);

        if (totalMes > 5000 && totalMes < 7000) {
            await this.sendMessage(from, `⚠️ *ALERTA:* Seus gastos do mês já somam R$ ${totalMes.toFixed(2)}. Fique atento!`);
        } else if (totalMes >= 7000) {
            await this.sendMessage(from, `🔴 *URGENTE:* Você já gastou R$ ${totalMes.toFixed(2)} este mês! Revise seus gastos.`);
        }
    }

    getMemberName(phoneNumber, notifyName = '') {
        if (notifyName && config.members[notifyName]) {
            return config.members[notifyName];
        }
        const cleanNumber = phoneNumber.replace('@c.us', '').replace('@lid', '').replace('+', '');
        return config.members[cleanNumber] || 'Desconhecido';
    }

    async sendMessage(to, text) {
        try {
            if (text.length > 4096) {
                const chunks = this.splitMessage(text, 4000);
                for (const chunk of chunks) {
                    await this.client.sendMessage(to, chunk);
                }
            } else {
                await this.client.sendMessage(to, text);
            }
        } catch (error) {
            logger.error('Erro ao enviar mensagem:', error);
        }
    }

    splitMessage(text, maxLength) {
        const chunks = [];
        let currentChunk = '';

        const lines = text.split('\n');
        for (const line of lines) {
            if ((currentChunk + line + '\n').length > maxLength) {
                chunks.push(currentChunk);
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    async start() {
        const ok = await this.initialize();
        if (!ok) {
            logger.error('Inicialização falhou, bot não será iniciado.');
            process.exit(1);
        }
        this.client.initialize();
        logger.info('Bot iniciado, aguardando conexão...');
    }
}

module.exports = FinanceBot;