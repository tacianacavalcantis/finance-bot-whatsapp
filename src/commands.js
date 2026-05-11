const moment = require('moment');
const config = require('../config/config');

class CommandProcessor {
    constructor() {
        this.commands = config.commands;
    }

    processMessage(messageBody) {
        // Verificar se é comando do bot
        if (!messageBody.startsWith('/fin')) {
            return null;
        }
        
        // Remover prefixo
        const comando = messageBody.replace('/fin', '').trim();
        
        // Identificar tipo de comando
        if (this.matchCommand(comando, this.commands.despesa)) {
            return this.parseDespesa(comando);
        }
        
        if (this.matchCommand(comando, this.commands.receita)) {
            return this.parseReceita(comando);
        }
        
        if (this.matchCommand(comando, this.commands.relatorio)) {
            return this.parseRelatorio(comando);
        }
        
        if (this.matchCommand(comando, this.commands.saldo)) {
            return { type: 'saldo', params: {} };
        }
        
        if (this.matchCommand(comando, this.commands.categorias)) {
            return { type: 'categorias', params: {} };
        }
        
        if (this.matchCommand(comando, this.commands.ajuda)) {
            return { type: 'ajuda', params: {} };
        }
        
        return { type: 'desconhecido', params: {} };
    }

    matchCommand(text, commandList) {
        const firstWord = text.split(' ')[0];
        return commandList.includes(firstWord);
    }

    parseDespesa(text) {
        // Formato: desp 150.50 Alimentação Compra do mês
        // ou: despesa 150.50 Alimentação Compra do mês
        const parts = text.split(' ');
        
        if (parts.length < 3) {
            return { type: 'erro', error: 'Formato inválido. Use: /fin desp VALOR CATEGORIA DESCRIÇÃO' };
        }
        
        const valor = parseFloat(parts[1].replace(',', '.'));
        
        if (isNaN(valor)) {
            return { type: 'erro', error: 'Valor inválido. Use números.' };
        }
        
        const categoria = parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase();
        
        // Validar categoria
        if (!config.financial.categorias.includes(categoria)) {
            return { 
                type: 'erro', 
                error: `Categoria inválida. Categorias disponíveis: ${config.financial.categorias.join(', ')}` 
            };
        }
        
        const descricao = parts.slice(3).join(' ') || 'Sem descrição';
        
        return {
            type: 'despesa',
            params: {
                valor: valor,
                categoria: categoria,
                descricao: descricao
            }
        };
    }

    parseReceita(text) {
        // Formato: rec 5000.00 Salário Pagamento mensal
        const parts = text.split(' ');
        
        if (parts.length < 3) {
            return { type: 'erro', error: 'Formato inválido. Use: /fin rec VALOR CATEGORIA DESCRIÇÃO' };
        }
        
        const valor = parseFloat(parts[1].replace(',', '.'));
        
        if (isNaN(valor)) {
            return { type: 'erro', error: 'Valor inválido. Use números.' };
        }
        
        const categoria = parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase();
        const descricao = parts.slice(3).join(' ') || 'Sem descrição';
        
        return {
            type: 'receita',
            params: {
                valor: valor,
                categoria: categoria,
                descricao: descricao
            }
        };
    }

    parseRelatorio(text) {
        const parts = text.split(' ');
        
        if (parts.length < 2) {
            return { type: 'relatorio', params: { periodo: 'mensal' } };
        }
        
        const periodo = parts[1];
        const periodosValidos = ['diario', 'semanal', 'mensal', 'anual'];
        
        if (!periodosValidos.includes(periodo)) {
            return { type: 'erro', error: 'Período inválido. Use: diario, semanal, mensal, anual' };
        }
        
        let dataInicio = null;
        if (parts[2]) {
            dataInicio = parts[2];
        }
        
        return {
            type: 'relatorio',
            params: {
                periodo: periodo,
                dataInicio: dataInicio
            }
        };
    }

    getMembroFromNumber(number) {
        const cleanNumber = number.replace('@c.us', '').replace('+', '');
        return config.members[cleanNumber] || 'Visitante';
    }
}

module.exports = new CommandProcessor();