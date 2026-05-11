const moment = require('moment');

class Utils {
    static formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }
    
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    static validatePhone(phone) {
        const re = /^[0-9]{10,13}$/;
        return re.test(phone);
    }
    
    static formatPhone(phone) {
        // Remove caracteres não numéricos
        let cleaned = phone.replace(/\D/g, '');
        
        // Adiciona código do país se necessário
        if (cleaned.length === 10) {
            cleaned = '55' + cleaned;
        }
        
        return cleaned;
    }
    
    static getMonthName(month) {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho