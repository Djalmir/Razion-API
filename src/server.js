require('dotenv/config')
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
const wsServer = require('./wsServer')

const app = express()

mongoose.connect(process.env.MONGO_URL)
app.use(cors({ origin: '*' }))
app.use(express.json())
app.use('/files', express.static(path.resolve(__dirname, '..', 'uploads')))

router.get('/', (req, res) => {
	return res.send("Boas Vindas!")
})
app.use(router)

require('./controllers/Auth/AuthController')(app)

const port = process.env.PORT || 3333

const server = app.listen(port, () => {
	console.log('______________________________')
	console.log('')
	console.log('✔ Servidor HTTP rodando na porta ' + port)
	console.log('______________________________')
})

wsServer(server)

mongoose.connection.on('connected', () => {
	console.log('')
	console.log('✔ Conectado ao Banco de Dados ')
	console.log('______________________________')
	console.log('')
	console.log('🟢 Todos os serviços rodando 🟢')
	console.log('______________________________')
	console.log('')
})
mongoose.connection.on('error', (error) => {
	console.error.bind(console.error, 'Erro na conexão com o Banco de Dados:')
	console.log('______________________________')
	mongoose.disconnect()
})