const config = require('../config/config');

class MessageParser {
    
    /**
     * Parseia mensagem no formato:
     * +200 freela deposito
     * -25 padaria dinheiro  
     * 67 farmacia credito 3x
     */
    static parseMessage(text, memberName) {
        const trimmedText = text.trim();
        
        // Detectar tipo (positivo = receita, negativo = despesa)
        let tipo = null;
        let valorTexto = '';
        let restoTexto = '';
        
        if (trimmedText.startsWith('+')) {
            tipo = 'receita';
            valorTexto = trimmedText.substring(1).trim();
        } else if (trimmedText.startsWith('-')) {
            tipo = 'despesa';
            valorTexto = trimmedText.substring(1).trim();
        } else {
            // Se não tem sinal, verifica se começa com número (despesa padrão)
            const match = trimmedText.match(/^(\d+[.,]?\d*)\s+(.+)/);
            if (match) {
                tipo = 'despesa';  // Sem sinal = despesa por padrão
                valorTexto = trimmedText;
            } else {
                return { success: false, error: 'Formato inválido. Use: +200 descrição forma ou -25 descrição forma' };
            }
        }
        
        // Extrair valor e descrição
        const valorMatch = valorTexto.match(/^(\d+[.,]?\d*)\s+(.+)/);
        if (!valorMatch) {
            return { success: false, error: 'Valor não identificado. Ex: +200 freela deposito' };
        }
        
        let valor = parseFloat(valorMatch[1].replace(',', '.'));
        const resto = valorMatch[2].trim();
        
        // Separar descrição e forma de pagamento
        const partes = resto.split(/\s+/);
        let descricao = '';
        let forma = 'dinheiro';  // padrão
        let parcela = 1;
        
        // Verificar se a última parte é uma forma de pagamento conhecida
        const ultimaPalavra = partes[partes.length - 1];
        const formasPagamento = config.financial.formasPagamento;
        
        // Verificar padrão "credito 3x"
        const parcelaMatch = ultimaPalavra.match(/^(\d+)x?$/i);
        
        if (parcelaMatch && partes.length >= 2) {
            // Tem formato "credito 3x" onde a penúltima é a forma e última é parcela
            parcela = parseInt(parcelaMatch[1]);
            forma = partes[partes.length - 2].toLowerCase();
            descricao = partes.slice(0, -2).join(' ');
            
            // Validar forma de pagamento
            if (!formasPagamento.includes(forma)) {
                forma = 'credito';  // padrão se não reconhecer
            }
        } 
        else if (formasPagamento.includes(ultimaPalavra.toLowerCase())) {
            // Última palavra é forma de pagamento sem parcela
            forma = ultimaPalavra.toLowerCase();
            descricao = partes.slice(0, -1).join(' ');
        }
        else {
            // Não identificou forma, usar padrão
            descricao = resto;
        }
        
        // Calcular valor da parcela
        const valorParcela = tipo === 'despesa' && parcela > 1 ? valor / parcela : valor;
        
        // Validar limites
        if (parcela > config.financial.maxParcelas) {
            return { success: false, error: `Máximo de ${config.financial.maxParcelas} parcelas permitido` };
        }
        
        if (valor <= 0) {
            return { success: false, error: 'Valor deve ser maior que zero' };
        }
        
        if (valor > 100000) {
            return { success: false, error: 'Valor muito alto (máximo R$ 100.000)' };
        }
        
        return {
            success: true,
            data: {
                tipo: tipo,
                valor: valor,
                forma: forma,
                parcela: parcela,
                valorParcela: valorParcela,
                descricao: descricao,
                nome: memberName,
                data: new Date(),
                parcelaAtual: 1  // Para controle de parcelas futuras
            }
        };
    }
    
    /**
     * Gera mensagem de confirmação
     */
    static gerarConfirmacao(transacao) {
        const tipoEmoji = transacao.tipo === 'receita' ? '💰' : '💸';
        const tipoTexto = transacao.tipo === 'receita' ? 'RECEITA' : 'DESPESA';
        
        let mensagem = `${tipoEmoji} ${tipoTexto} REGISTRADA!\n\n`;
        mensagem += `Valor: R$ ${transacao.valor.toFixed(2)}\n`;
        mensagem += `Descrição: ${transacao.descricao}\n`;
        mensagem += `Forma: ${transacao.forma}`;
        
        if (transacao.parcela > 1) {
            mensagem += `\nParcelas: ${transacao.parcela}x de R$ ${transacao.valorParcela.toFixed(2)}`;
        }
        
        mensagem += `\nMembro: ${transacao.nome}`;
        
        return mensagem;
    }
    
    /**
     * Gera relatório formatado
     */
    static gerarRelatorio(transacoes, periodo) {
        let relatorio = `📊 RESUMO ${periodo.toUpperCase()}\n`;
        relatorio += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // Separar receitas e despesas
        const receitas = transacoes.filter(t => t.tipo === 'receita');
        const despesas = transacoes.filter(t => t.tipo === 'despesa');
        
        const totalReceitas = receitas.reduce((sum, t) => sum + t.valor, 0);
        const totalDespesas = despesas.reduce((sum, t) => sum + t.valor, 0);
        const saldo = totalReceitas - totalDespesas;
        
        relatorio += `💵 RECEITAS: R$ ${totalReceitas.toFixed(2)}\n`;
        relatorio += `💸 DESPESAS: R$ ${totalDespesas.toFixed(2)}\n`;
        relatorio += `💰 SALDO: R$ ${saldo.toFixed(2)}\n\n`;
        
        // Despesas por forma de pagamento
        const despesasPorForma = {};
        despesas.forEach(d => {
            despesasPorForma[d.forma] = (despesasPorForma[d.forma] || 0) + d.valor;
        });
        
        if (Object.keys(despesasPorForma).length > 0) {
            relatorio += `💳 GASTOS POR FORMA:\n`;
            for (const [forma, valor] of Object.entries(despesasPorForma)) {
                relatorio += `  • ${forma}: R$ ${valor.toFixed(2)}\n`;
            }
            relatorio += `\n`;
        }
        
        // Últimas transações
        const ultimas = [...transacoes].reverse().slice(0, 5);
        if (ultimas.length > 0) {
            relatorio += `📝 ÚLTIMAS MOVIMENTAÇÕES:\n`;
            for (const t of ultimas) {
                const sinal = t.tipo === 'receita' ? '+' : '-';
                const dataFormatada = new Date(t.data).toLocaleDateString('pt-BR');
                relatorio += `${dataFormatada} ${sinal} R$ ${t.valor.toFixed(2)} - ${t.descricao}\n`;
            }
        }
        
        return relatorio;
    }
}

module.exports = MessageParser;