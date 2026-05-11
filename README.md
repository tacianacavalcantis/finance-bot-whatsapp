# 🤖 Bot Financeiro Familiar — WhatsApp

Bot de controle financeiro familiar integrado ao WhatsApp e Google Sheets. Permite registrar receitas e despesas via mensagem de texto, consultar saldo e gerar resumos mensais, tudo diretamente pelo WhatsApp.

---

## ✨ Funcionalidades

- 💰 Registro de receitas e despesas via mensagem
- 📊 Resumo financeiro mensal
- 💳 Suporte a múltiplas formas de pagamento
- 📅 Parcelamento automático no crédito
- 👥 Controle por membro da família
- ⚠️ Alertas de gastos excessivos
- 📝 Armazenamento automático no Google Sheets

---

## 📋 Pré-requisitos

- Node.js 16+ (recomendado 18)
- Conta Google Cloud com projeto criado
- Planilha no Google Sheets
- Service Account do Google com acesso à planilha
- Número de WhatsApp dedicado ao bot

---

## 🚀 Instalação Local

### 1. Clone o repositório

```bash
git clone git@github.com:tacianacavalcantis/finance-bot-whatsapp.git
cd finance-bot-whatsapp
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=sua-conta@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=id_da_sua_planilha
```

### 4. Configure os membros

Edite o arquivo `config/config.js` e adicione os membros da família:

```js
members: {
    'NomeNoWhatsApp': 'Nome Completo',
    'Tacia': 'Taciana',
    'Marilene': 'Marilene',
},
```

### 5. Inicie o bot

```bash
npm start
```

Escaneie o QR code com o WhatsApp para autenticar.

---

## ☁️ Deploy no Google Cloud (Compute Engine)

### 1. Crie uma VM

- Tipo: `e2-micro` ou `e2-small`
- Sistema: Ubuntu 22.04 ou 24.04 LTS
- Região: `us-west1` ou `southamerica-east1`

### 2. Conecte na VM

```bash
gcloud compute ssh NOME_DA_VM --zone=ZONA
```

### 3. Instale as dependências do sistema

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

sudo apt-get install -y libgbm-dev libasound2t64 libatk1.0-0t64 libcairo2 \
  libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgdk-pixbuf2.0-0 \
  libglib2.0-0t64 libgtk-3-0t64 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
  libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
  ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget
```

### 4. Instale o PM2

```bash
sudo npm install -g pm2
```

### 5. Clone e configure o projeto

```bash
git clone git@github.com:tacianacavalcantis/finance-bot-whatsapp.git
cd finance-bot-whatsapp
npm install
nano .env  # adicione suas credenciais
```

### 6. Inicie com PM2

```bash
pm2 start src/index.js --name finance-bot
pm2 startup
pm2 save
```

---

## 📱 Como usar

### Registrar despesa

```
-25 padaria dinheiro
67 farmacia credito 3x
150 restaurante debito
```

### Registrar receita

```
+200 freela deposito
+5000 salario pix
```

### Comandos disponíveis

| Comando | Descrição |
|--------|-----------|
| `resumo` | Resumo financeiro do mês atual |
| `saldo` | Seu saldo pessoal do mês |
| `ajuda` | Lista todos os comandos e formatos |

### Formas de pagamento aceitas

`dinheiro` · `debito` · `credito` · `pix` · `deposito` · `transferencia` · `boleto`

### Parcelamento

Use `credito Nx` para parcelar automaticamente nos próximos meses:

```
500 notebook credito 10x
```

---

## 🗂️ Estrutura do projeto

```
finance-bot-whatsapp/
├── src/
│   ├── index.js       # Entrada da aplicação
│   ├── bot.js         # Lógica principal do bot
│   ├── parser.js      # Parser de mensagens
│   ├── sheets.js      # Integração Google Sheets
│   ├── commands.js    # Processador de comandos
│   └── utils.js       # Utilitários
├── config/
│   └── config.js      # Configurações gerais
├── .env               # Variáveis de ambiente (não versionar)
├── .gitignore
└── package.json
```

---

## 🔧 Comandos PM2

```bash
pm2 status                  # Ver status do bot
pm2 logs finance-bot        # Ver logs em tempo real
pm2 restart finance-bot     # Reiniciar o bot
pm2 stop finance-bot        # Parar o bot
pm2 resurrect               # Restaurar após reinicialização da VM
```

---

## ⚠️ Alertas automáticos

O bot envia alertas automáticos quando os gastos mensais ultrapassam os limites configurados:

- 🟡 Acima de R$ 5.000 — alerta de atenção
- 🔴 Acima de R$ 7.000 — alerta urgente

Os limites podem ser ajustados em `src/bot.js` no método `checkAlerts`.

---

## 🔒 Segurança

- Nunca versione o arquivo `.env`
- Use repositório **privado** no GitHub
- A service account do Google deve ter acesso **somente** à planilha necessária
- O bot ignora mensagens de grupos por padrão

---

## 📄 Licença

MIT
