require('dotenv').config();
const path = require('path');

module.exports = {
    // Configurações do WhatsApp
    whatsapp: {
        sessionDir: process.env.WHATSAPP_SESSION_DIR || './sessions',
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    },
    
    // Configurações do Google Sheets
    googleSheets: {
        spreadsheetId: process.env.SPREADSHEET_ID,
        sheets: {
            transacoes: 'Transacoes',  // Aba única para todas transações
            resumo: 'Resumo',
            membros: 'Membros'
        }
    },
    
    // Configurações financeiras
    financial: {
        formasPagamento: ['dinheiro', 'credito', 'debito', 'pix', 'deposito', 'transferencia', 'boleto'],
    },
    
        // Membros da família (mapeamento número -> nome)
    members: {
        'Tacia': 'Taciana',
        'Marilene': 'Marilene',
    },
    memberNumbers: {
    '5511914790330': '5511914790330@c.us',
    '5513992134532': '5513992134532@c.us',
},
    
    // Palavras-chave para identificar tipo de transação
    keywords: {
        receita: ['+', 'recebido', 'ganho', 'salario', 'freela', 'bonus'],
        despesa: ['-', 'gasto', 'paguei', 'comprei']
    }
};