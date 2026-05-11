const FinanceBot = require('./bot');
const logger = require('./logger');

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    logger.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rejeitada não tratada:', reason);
});

// Iniciar bot
async function main() {
    const bot = new FinanceBot();
    await bot.start();
    
    // Manter processo vivo
    process.stdin.resume();
}

main();