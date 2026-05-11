const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('../config/config');
const logger = require('./logger');

class GoogleSheetsManager {
    constructor() {
        this.doc = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            const privateKey = process.env.GOOGLE_PRIVATE_KEY
                .replace(/\\n/g, '\n')
                .replace(/^"|"$/g, '');  // remove aspas extras se houver

            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: privateKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

            this.doc = new GoogleSpreadsheet(config.googleSheets.spreadsheetId, serviceAccountAuth);
            await this.doc.loadInfo();
            
            await this.ensureSheets();
            
            this.initialized = true;
            logger.info('Google Sheets inicializado com sucesso');
            return true;
        } catch (error) {
            logger.error('Erro ao inicializar Google Sheets:', error);
            throw error;
        }
    }

    async ensureSheets() {
        // Aba principal de transações
        let sheet = this.doc.sheetsByTitle['Transacoes'];
        if (!sheet) {
            sheet = await this.doc.addSheet({ title: 'Transacoes', headerValues: [
                'Data', 'Tipo', 'Valor', 'Forma', 'Parcela', 'ValorParcela', 
                'Descricao', 'Nome', 'Timestamp', 'Mes', 'Ano', 'ParcelaAtual'
            ]});
            logger.info('Aba Transacoes criada');
        }
        
        // Aba de resumo mensal
        let resumoSheet = this.doc.sheetsByTitle['Resumo'];
        if (!resumoSheet) {
            resumoSheet = await this.doc.addSheet({ title: 'Resumo', headerValues: [
                'Mes', 'Ano', 'TotalReceitas', 'TotalDespesas', 'Saldo'
            ]});
            logger.info('Aba Resumo criada');
        }
        
        // Aba de membros
        let membrosSheet = this.doc.sheetsByTitle['Membros'];
        if (!membrosSheet) {
            membrosSheet = await this.doc.addSheet({ title: 'Membros', headerValues: [
                'Nome', 'Telefone', 'DataCadastro'
            ]});
            
            // Adicionar membros configurados
            for (const [telefone, nome] of Object.entries(config.members)) {
                await membrosSheet.addRow({
                    Nome: nome,
                    Telefone: telefone,
                    DataCadastro: new Date().toISOString()
                });
            }
            logger.info('Aba Membros criada com membros configurados');
        }
    }

    async registrarTransacao(transacao) {
        try {
            const sheet = this.doc.sheetsByTitle['Transacoes'];
            const dataAtual = new Date();
            
            // Se for parcela, criar múltiplas entradas
            if (transacao.tipo === 'despesa' && transacao.parcela > 1) {
                const registros = [];
                for (let i = 1; i <= transacao.parcela; i++) {
                    const dataParcela = new Date(dataAtual);
                    dataParcela.setMonth(dataAtual.getMonth() + (i - 1));
                    
                    registros.push({
                        Data: this.formatDate(dataParcela),
                        Tipo: transacao.tipo,
                        Valor: transacao.valorParcela,
                        Forma: transacao.forma,
                        Parcela: transacao.parcela,
                        ValorParcela: transacao.valorParcela,
                        Descricao: `${transacao.descricao} (${i}/${transacao.parcela})`,
                        Nome: transacao.nome,
                        Timestamp: dataAtual.toISOString(),
                        Mes: dataParcela.getMonth() + 1,
                        Ano: dataParcela.getFullYear(),
                        ParcelaAtual: i
                    });
                }
                
                for (const registro of registros) {
                    await sheet.addRow(registro);
                }
                
                logger.info(`${transacao.parcela}x parcelas registradas: ${transacao.valor} - ${transacao.descricao}`);
                return { success: true, data: registros, isParcelado: true };
            } 
            else {
                // Transação simples
                const novaLinha = {
                    Data: transacao.data ? this.formatDate(transacao.data) : this.formatDate(dataAtual),
                    Tipo: transacao.tipo,
                    Valor: transacao.valor,
                    Forma: transacao.forma,
                    Parcela: transacao.parcela || 1,
                    ValorParcela: transacao.valorParcela || transacao.valor,
                    Descricao: transacao.descricao,
                    Nome: transacao.nome,
                    Timestamp: dataAtual.toISOString(),
                    Mes: dataAtual.getMonth() + 1,
                    Ano: dataAtual.getFullYear(),
                    ParcelaAtual: 1
                };
                
                await sheet.addRow(novaLinha);
                logger.info(`Transação registrada: ${transacao.tipo} ${transacao.valor} - ${transacao.descricao}`);
                return { success: true, data: [novaLinha], isParcelado: false };
            }
        } catch (error) {
            logger.error('Erro ao registrar transação:', error);
            return { success: false, error: error.message };
        }
    }

    async getTransacoes(filtros = {}) {
        try {
            const sheet = this.doc.sheetsByTitle['Transacoes'];
            const rows = await sheet.getRows();
            
            let transacoes = rows.map(row => ({
                data: row.Data,
                tipo: row.Tipo,
                valor: parseFloat(row.Valor),
                forma: row.Forma,
                parcela: parseInt(row.Parcela),
                valorParcela: parseFloat(row.ValorParcela),
                descricao: row.Descricao,
                nome: row.Nome,
                mes: parseInt(row.Mes),
                ano: parseInt(row.Ano),
                parcelaAtual: parseInt(row.ParcelaAtual)
            }));
            
            // Aplicar filtros
            if (filtros.mes) {
                transacoes = transacoes.filter(t => t.mes === filtros.mes && t.ano === (filtros.ano || new Date().getFullYear()));
            }
            
            if (filtros.nome) {
                transacoes = transacoes.filter(t => t.nome === filtros.nome);
            }
            
            if (filtros.tipo) {
                transacoes = transacoes.filter(t => t.tipo === filtros.tipo);
            }
            
            if (filtros.dataInicio) {
                transacoes = transacoes.filter(t => new Date(t.data) >= new Date(filtros.dataInicio));
            }
            
            if (filtros.dataFim) {
                transacoes = transacoes.filter(t => new Date(t.data) <= new Date(filtros.dataFim));
            }
            
            return { success: true, data: transacoes };
        } catch (error) {
            logger.error('Erro ao buscar transações:', error);
            return { success: false, error: error.message };
        }
    }

    async getResumoPeriodo(dataInicio, dataFim) {
        const transacoesResult = await this.getTransacoes({
            dataInicio: dataInicio,
            dataFim: dataFim
        });
        
        if (!transacoesResult.success) {
            return { success: false, error: transacoesResult.error };
        }
        
        const transacoes = transacoesResult.data;
        const receitas = transacoes.filter(t => t.tipo === 'receita');
        const despesas = transacoes.filter(t => t.tipo === 'despesa');
        
        const totalReceitas = receitas.reduce((sum, t) => sum + t.valor, 0);
        const totalDespesas = despesas.reduce((sum, t) => sum + t.valor, 0);
        
        // Resumo por membro
        const resumoMembros = {};
        for (const membro of Object.values(config.members)) {
            const receitasMembro = receitas.filter(r => r.nome === membro).reduce((sum, r) => sum + r.valor, 0);
            const despesasMembro = despesas.filter(d => d.nome === membro).reduce((sum, d) => sum + d.valor, 0);
            resumoMembros[membro] = {
                receitas: receitasMembro,
                despesas: despesasMembro,
                saldo: receitasMembro - despesasMembro
            };
        }
        
        // Resumo por forma de pagamento
        const resumoFormas = {};
        despesas.forEach(d => {
            resumoFormas[d.forma] = (resumoFormas[d.forma] || 0) + d.valor;
        });
        
        return {
            success: true,
            data: {
                receitas: receitas,
                despesas: despesas,
                totalReceitas: totalReceitas,
                totalDespesas: totalDespesas,
                saldoTotal: totalReceitas - totalDespesas,
                resumoMembros: resumoMembros,
                resumoFormas: resumoFormas,
                totalTransacoes: transacoes.length
            }
        };
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

module.exports = new GoogleSheetsManager();